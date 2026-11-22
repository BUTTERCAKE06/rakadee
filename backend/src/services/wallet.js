// Wallet Service  — 5.1, 5.2 ใน docs/api-spec/api-spec.md
// wallet.create(userId)
const { withTransaction, pool } = require('../config/db');
const { calculatePlatformFee } = require('./escrow');
const settings = require('./settings');

const INITIAL_CREDIT_AMOUNT = 10000.00; // ค่าเริ่มต้น D-05 ค่าจริงอ่านจากตั้งค่าระบบ (initial_wallet_credit)

/**
 * สร้างกระเป๋าเงิน Mock Wallet และเติมเครดิตแรกเข้า 10,000 บาท (D-05)
 * @param {number} userId รหัสผู้ใช้
 * @param {object} [existingConn] connection ในกรณีที่เรียกจาก transaction ภายนอก
 * @returns {Promise<{ walletId: number, balance: number }>}
 */
async function create(userId, existingConn = null) {
  const credit = await settings.initialCredit();
  const runner = async (conn) => {
    // 1. ตรวจสอบว่ามี Wallet อยู่แล้วหรือไม่ (กันสร้างซ้ำ)
    const [existing] = await conn.query(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (existing.length > 0) {
      return {
        walletId: Number(existing[0].id),
        balance: Number(existing[0].balance),
      };
    }

    // 2. สร้าง Wallet ด้วยยอดเครดิตเริ่มต้น 10,000 บาท
    const [result] = await conn.query(
      'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
      [userId, credit]
    );
    const walletId = Number(result.insertId);

    // 3. บันทึกธุรกรรมแรกเข้าใน ledger (ข้ามเมื่อตั้งเครดิตเป็น 0 เพราะ ledger ห้ามยอด 0)
    if (credit > 0) {
      await conn.query(
        `INSERT INTO wallet_transactions
          (wallet_id, type, amount, balance_after, note)
         VALUES (?, 'initial_credit', ?, ?, 'เครดิตแรกเข้า')`,
        [walletId, credit, credit]
      );
    }

    return {
      walletId,
      balance: credit,
    };
  };

  if (existingConn) {
    return runner(existingConn);
  }
  return withTransaction(runner);
}

/**
 * ดึงยอดเงินคงเหลือในกระเป๋า
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getBalance(userId) {
  const [rows] = await pool.query(
    'SELECT balance FROM wallets WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) return 0.00;
  return Number(rows[0].balance);
}

/**
 * ดึงข้อมูลสรุปกระเป๋าเงิน: ยอดเงินคงเหลือ + ยอดเงินรอรับของผู้ขาย (7.1)
 * @param {number} userId
 */
async function getWalletSummary(userId) {
  const balance = await getBalance(userId);

  // คำนวณยอดเงินรอรับ (Pending Income จาก Escrow ที่ยัง held อยู่ของผู้ขาย หักค่าธรรมเนียมตามสูตร D-10)
  const [escrowRows] = await pool.query(
    `SELECT e.amount, o.item_price, o.shipping_fee
     FROM escrows e
     JOIN orders o ON e.order_id = o.id
     WHERE o.seller_id = ? AND e.status = 'held'`,
    [userId]
  );

  const feeCfg = await settings.feeConfig();
  let pendingIncome = 0;
  for (const row of escrowRows) {
    const fee = calculatePlatformFee(Number(row.item_price), feeCfg);
    const net = Math.max(0, Number(row.amount) - fee);
    pendingIncome += net;
  }

  return {
    balance,
    pendingIncome: Number(pendingIncome.toFixed(2)),
    currency: 'THB',
  };
}

/**
 * ดึงประวัติธุรกรรมกระเป๋าเงินแบบแบ่งหน้า (7.2)
 * @param {number} userId
 * @param {number} page
 * @param {number} limit
 */
async function getTransactions(userId, page = 1, limit = 20) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 20));
  const offset = (p - 1) * l;

  // หา wallet_id ของ user
  const [wallets] = await pool.query('SELECT id FROM wallets WHERE user_id = ?', [userId]);
  if (wallets.length === 0) {
    return { items: [], page: p, limit: l, total: 0 };
  }
  const walletId = wallets[0].id;

  // นับจำนวนธุรกรรมทั้งหมด
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM wallet_transactions WHERE wallet_id = ?',
    [walletId]
  );
  const total = Number(countRows[0].total);

  // ดึงรายการธุรกรรม
  const [rows] = await pool.query(
    `SELECT
      id, type, amount, balance_after, reference_type, reference_id, note, created_at
     FROM wallet_transactions
     WHERE wallet_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [walletId, l, offset]
  );

  const items = rows.map((r) => ({
    id: Number(r.id),
    type: r.type,
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    referenceType: r.reference_type,
    referenceId: r.reference_id ? Number(r.reference_id) : null,
    note: r.note,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  return {
    items,
    page: p,
    limit: l,
    total,
  };
}

module.exports = {
  create,
  getBalance,
  getWalletSummary,
  getTransactions,
  INITIAL_CREDIT_AMOUNT,
};
