// Escrow Service  —  5.3, 5.4, D-08, D-10 ใน docs/api-spec/api-spec.md
//   - escrow.hold(orderId)
//   - escrow.release(orderId)
//   - escrow.refund(orderId)
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { notify, EVENTS } = require('./notify');
const settings = require('./settings');
const dispute = require('./dispute');

// แปลงเป็นสตางค์ เพื่อคำนวณเงินอย่างแม่นยำ ไม่ผ่าน float ตาม AGENTS.md
function toSatang(value) {
  const s = typeof value === 'number' ? value.toFixed(2) : String(value || '0').trim();
  const [baht, frac = ''] = s.split('.');
  return Number(baht) * 100 + Number(frac.padEnd(2, '0'));
}
const toDecimal = (satang) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;

// ค่าเริ่มต้นตาม requirement 5.4 (ค่าจริงอ่านจากตั้งค่าระบบด้วย settings.feeConfig())
const DEFAULT_FEE = { percent: 5, min: 20 };

/**
 * คำนวณค่าธรรมเนียมแพลตฟอร์ม requirement 5.4 / D-10
 * สูตร: min(max(ราคาปิด × percent%, min), ราคาปิด) ค่าเริ่มต้น 5% ขั้นต่ำ 20 บาท (Super Admin แก้ได้ที่ตั้งค่าระบบ)
 * คำนวณจากราคาปิดประมูลเท่านั้น (ไม่รวมค่าส่ง) เป็นสตางค์จำนวนเต็ม
 * @param {number} itemPrice ราคาปิดประมูล (บาท)
 * @param {{ percent: number, min: number }} [cfg] จาก settings.feeConfig()
 * @returns {number} ค่าธรรมเนียม (บาท)
 */
function calculatePlatformFee(itemPrice, cfg = DEFAULT_FEE) {
  const itemSatang = Math.round(Number(itemPrice) * 100);
  const minFeeSatang = Math.round(Number(cfg.min) * 100);
  const basisPoints = Math.round(Number(cfg.percent) * 100); // 5% = 500
  const calculatedFeeSatang = Math.round((itemSatang * basisPoints) / 10000);

  let feeSatang = Math.max(calculatedFeeSatang, minFeeSatang);
  feeSatang = Math.min(feeSatang, itemSatang); // ห้ามเกินราคาประมูล

  return feeSatang / 100;
}

/**
 * พักเงินคำสั่งซื้อใน Escrow (สร้างตอนแอดมินอนุมัติการชำระ (5.3))
 * @param {number} orderId รหัสคำสั่งซื้อ
 * @param {object} [existingConn] connection ในกรณีเรียกจาก transaction ภายนอก
 * @returns {Promise<{ orderId: number, amount: number, status: string }>}
 */
async function hold(orderId, existingConn = null) {
  const runner = async (conn) => {
    // 1. ดึงยอดรวมของ Order
    const [orders] = await conn.query(
      'SELECT id, total_amount, status FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orders.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำสั่งซื้อที่ระบุ');
    }

    const order = orders[0];
    const totalAmount = Number(order.total_amount);

    // 2. 1 order = 1 escrow: ถ้ามีอยู่แล้วห้ามรีเซ็ตกลับเป็น held (กันปล่อยเงิน/คืนเงินซ้ำ)
    const [existing] = await conn.query('SELECT status FROM escrows WHERE order_id = ? FOR UPDATE', [orderId]);
    if (existing.length > 0) {
      if (existing[0].status === 'held') return { orderId: Number(orderId), amount: totalAmount, status: 'held' };
      throw new AppError(409, 'INVALID_STATE', `คำสั่งซื้อนี้ปิดเงินพักไปแล้ว (สถานะ ${existing[0].status})`);
    }
    await conn.query(
      `INSERT INTO escrows (order_id, amount, status, held_at)
       VALUES (?, ?, 'held', UTC_TIMESTAMP())`,
      [orderId, totalAmount]
    );

    return {
      orderId: Number(orderId),
      amount: totalAmount,
      status: 'held',
    };
  };

  if (existingConn) return runner(existingConn);
  return withTransaction(runner);
}

/**
 * ปล่อยเงินให้ผู้ขาย (หักค่าธรรมเนียม) ตอนผู้ซื้อยืนยันรับ / ครบ 7 วัน / ผู้ขายชนะข้อพิพาท (D-10)
 * @param {number} orderId รหัสคำสั่งซื้อ
 * @param {object} [existingConn]
 */
async function release(orderId, existingConn = null) {
  const runner = async (conn) => {
    // 1. ตรวจสอบข้อพิพาทที่ยังเปิดอยู่ (ถ้ามีห้ามปล่อยเงิน D-08 ผ่าน shared interface dispute.isOpen)
    if (await dispute.isOpen(orderId, conn)) {
      throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถปล่อยเงินได้เนื่องจากมีข้อพิพาทที่ยังไม่สิ้นสุด');
    }

    // 2. ดึงข้อมูล Escrow
    const [escrows] = await conn.query(
      'SELECT id, amount, status FROM escrows WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    if (escrows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการเงินพัก');
    }

    const escrow = escrows[0];
    if (escrow.status !== 'held') {
      throw new AppError(409, 'INVALID_STATE', `ไม่สามารถปล่อยเงินได้เนื่องจากสถานะคือ ${escrow.status}`);
    }

    // 3. ดึงข้อมูล Order เพื่อหาผู้ขายและราคาปิดสำหรับคิดค่าธรรมเนียม
    const [orders] = await conn.query(
      'SELECT id, seller_id, buyer_id, item_price, shipping_fee, total_amount FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    const order = orders[0];
    const sellerId = Number(order.seller_id);
    const itemPrice = Number(order.item_price);
    const totalSatang = toSatang(order.total_amount);

    // 4. คำนวณค่าธรรมเนียมแพลตฟอร์ม: คิดจาก item_price เท่านั้น (D-10) เป็นหน่วยสตางค์
    const feeAmount = calculatePlatformFee(itemPrice, await settings.feeConfig()); // ค่าตั้ง ณ เวลาปล่อยเงิน
    const feeSatang = toSatang(feeAmount);
    const netSellerSatang = Math.max(0, totalSatang - feeSatang);
    const netSellerDecimal = toDecimal(netSellerSatang);
    const feeDecimal = toDecimal(feeSatang);

    // 5. โอนเงินสุทธิเข้า Wallet ของผู้ขาย (คำนวณแบบ integer satang)
    const [sellerWallets] = await conn.query(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [sellerId]
    );
    if (sellerWallets.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'ไม่พบกระเป๋าเงินของผู้ขาย');
    }

    const sellerWallet = sellerWallets[0];
    const balanceBeforeSatang = toSatang(sellerWallet.balance);
    const balanceAfterSatang = balanceBeforeSatang + netSellerSatang;
    const balanceAfterDecimal = toDecimal(balanceAfterSatang);

    await conn.query(
      'UPDATE wallets SET balance = ? WHERE id = ?',
      [balanceAfterDecimal, sellerWallet.id]
    );

    // 6. บันทึกธุรกรรม ledger (wallet_transactions)
    await conn.query(
      `INSERT INTO wallet_transactions
        (wallet_id, type, amount, balance_after, reference_type, reference_id, note)
       VALUES (?, 'sale_proceeds', ?, ?, 'order', ?, ?)`,
      [sellerWallet.id, netSellerDecimal, balanceAfterDecimal, orderId, `รายได้จากคำสั่งซื้อ #${orderId} (หักค่าธรรมเนียม ${feeDecimal} บาท)`]
    );

    // 7. อัปเดตสถานะ Escrow เป็น 'released'
    await conn.query(
      `UPDATE escrows
       SET status = 'released', fee_amount = ?, net_amount = ?, released_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [feeDecimal, netSellerDecimal, escrow.id]
    );

    // 8. อัปเดต Order เป็น 'completed'
    await conn.query(
      'UPDATE orders SET status = \'completed\', completed_at = UTC_TIMESTAMP() WHERE id = ?',
      [orderId]
    );

    // แจ้งเตือนผู้ขาย (เงินเข้ากระเป๋า)
    notify(sellerId, EVENTS.FUNDS_RELEASED, {
      orderId,
      amount: netSellerAmount,
      feeAmount,
    }).catch(() => {});

    // แจ้งเตือนผู้ซื้อ (คำสั่งซื้อเสร็จสมบูรณ์) — notify ทั้งสองฝั่งตาม requirement
    if (order.buyer_id) {
      notify(order.buyer_id, EVENTS.PAYMENT_SUCCESS, {
        orderId,
        title: 'คำสั่งซื้อเสร็จสมบูรณ์',
        message: `คำสั่งซื้อ #${orderId} เสร็จสมบูรณ์แล้ว ระบบได้ปล่อยเงินให้ผู้ขายเรียบร้อย`,
      }).catch(() => {});
    }

    return {
      orderId: Number(orderId),
      totalAmount,
      feeAmount,
      netSellerAmount,
      status: 'released',
    };
  };

  if (existingConn) return runner(existingConn);
  return withTransaction(runner);
}

/**
 * คืนเงินเต็มจำนวนให้ผู้ซื้อ (ผู้ขายไม่ส่งสินค้าเกิน 72 ชม. หรือผู้ซื้อชนะข้อพิพาท (D-10)
 * @param {number} orderId รหัสคำสั่งซื้อ
 * @param {object} [existingConn]
 */
async function refund(orderId, existingConn = null) {
  const runner = async (conn) => {
    // 1. ดึงข้อมูล Escrow
    const [escrows] = await conn.query(
      'SELECT id, amount, status FROM escrows WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    if (escrows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการเงินพักใน Escrow');
    }

    const escrow = escrows[0];
    if (escrow.status !== 'held') {
      throw new AppError(409, 'INVALID_STATE', `ไม่สามารถคืนเงินได้เนื่องจากสถานะ Escrow คือ ${escrow.status}`);
    }

    // 2. ดึงข้อมูล Order เพื่อหาผู้ซื้อ
    const [orders] = await conn.query(
      'SELECT id, buyer_id, total_amount FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    const order = orders[0];
    const buyerId = Number(order.buyer_id);
    const refundAmount = Number(escrow.amount); // คืนเต็มจำนวน (ราคา + ค่าส่ง)

    // 3. คืนเงินเข้า Wallet ของผู้ซื้อ (คำนวณแบบ integer satang)
    const [buyerWallets] = await conn.query(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [buyerId]
    );
    if (buyerWallets.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'ไม่พบกระเป๋าเงินของผู้ซื้อ');
    }

    const buyerWallet = buyerWallets[0];
    const balanceBeforeSatang = toSatang(buyerWallet.balance);
    const refundSatang = toSatang(escrow.amount); // คืนเต็มจำนวน (ราคา + ค่าส่ง)
    const balanceAfterSatang = balanceBeforeSatang + refundSatang;
    const balanceAfterDecimal = toDecimal(balanceAfterSatang);
    const refundDecimal = toDecimal(refundSatang);

    await conn.query(
      'UPDATE wallets SET balance = ? WHERE id = ?',
      [balanceAfterDecimal, buyerWallet.id]
    );

    // 4. บันทึกธุรกรรม ledger (wallet_transactions)
    await conn.query(
      `INSERT INTO wallet_transactions
        (wallet_id, type, amount, balance_after, reference_type, reference_id, note)
       VALUES (?, 'escrow_refund', ?, ?, 'order', ?, ?)`,
      [buyerWallet.id, refundDecimal, balanceAfterDecimal, orderId, `คืนเงินจากคำสั่งซื้อ #${orderId}`]
    );

    // 5. อัปเดตสถานะ Escrow เป็น 'refunded'
    await conn.query(
      `UPDATE escrows
       SET status = 'refunded', refunded_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [escrow.id]
    );

    // แจ้งเตือนผู้ซื้อ
    notify(buyerId, EVENTS.REFUNDED, {
      orderId,
      amount: refundAmount,
    }).catch(() => {});

    return {
      orderId: Number(orderId),
      refundAmount,
      status: 'refunded',
    };
  };

  if (existingConn) return runner(existingConn);
  return withTransaction(runner);
}

module.exports = {
  calculatePlatformFee,
  hold,
  release,
  refund,
};

