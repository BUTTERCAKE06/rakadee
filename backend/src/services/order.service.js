// Order service — order.create() (เจ้าของ: Programmer ตาม Interface ใน AGENTS.md)
// ใช้ตอนปิดประมูลที่มีผู้ชนะ (Scheduler closeAuctions) และตอน Buy Now
// SA รับต่อในเฟส 2 (ชำระเงิน) ส่วนฟังก์ชันจัดส่งของ PM เพิ่มต่อในไฟล์นี้ได้
//
// ตาม schema.sql + api-spec หัวข้อ 6 ("order.create()"):
//   - สร้างแถว orders สถานะ pending_payment, item_price, shipping_fee, total_amount
//   - snapshot ที่อยู่เริ่มต้นของผู้ซื้อลง orders.shipping_address (ไม่มีที่อยู่ = {} ผู้ซื้อต้องเลือกก่อนชำระ)
//   - payment_due_at = now + time.paymentDueMs
//   - แถว payments สร้างตอนผู้ซื้อกดชำระ (1 แถว = 1 ครั้งที่ชำระ ตามคอมเมนต์ใน schema.sql) จึงไม่สร้างที่นี่
const db = require('../config/db');
const time = require('../config/time');
const AppError = require('../utils/AppError');

// DECIMAL / ตัวเลข -> สตางค์ (จำนวนเต็ม) ไม่ผ่าน float
function toSatang(value) {
  const s = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`invalid money: ${value}`);
  const [baht, frac = ''] = s.split('.');
  return Number(baht) * 100 + Number(frac.padEnd(2, '0'));
}
const toDecimal = (satang) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;

/**
 * order.create(listingId, buyerId, price) — Interface กลาง (ห้ามเปลี่ยนชื่อหรือพารามิเตอร์ 3 ตัวแรก)
 * @param {number} listingId
 * @param {number} buyerId ผู้ชนะ / ผู้ซื้อทันที
 * @param {number|string} price ราคาปิด (บาท ทศนิยม 2 ตำแหน่ง) = orders.item_price
 * @param {object} [options]
 * @param {object} [options.conn] connection ของ transaction ที่ล็อก listing อยู่ (ปิดประมูลกับสร้าง Order ต้องอยู่ transaction เดียวกัน)
 * @param {'auction'|'buy_now'} [options.closingType='auction']
 * @returns {Promise<{ orderId, totalAmount, paymentDueAt }>}
 */
async function create(listingId, buyerId, price, options = {}) {
  const { conn, closingType = 'auction' } = options;
  if (!['auction', 'buy_now'].includes(closingType)) throw new Error(`invalid closingType: ${closingType}`);
  const run = (work) => (conn ? work(conn) : db.withTransaction(work));

  return run(async (c) => {
    const [[listing]] = await c.query('SELECT id, seller_id, shipping_fee FROM listings WHERE id = ?', [listingId]);
    if (!listing) throw new AppError(404, 'NOT_FOUND', 'ไม่พบสินค้านี้');

    const itemPrice = toSatang(price);
    const shippingFee = toSatang(listing.shipping_fee);
    const total = itemPrice + shippingFee;

    // ที่อยู่เริ่มต้น ถ้าไม่ได้ตั้งค่าเริ่มต้นไว้ใช้ที่อยู่ล่าสุด ถ้าไม่มีเลยเก็บ {}
    const [[addr]] = await c.query(
      `SELECT recipient_name, phone, address_line, sub_district, district, province, postal_code
         FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC LIMIT 1`,
      [buyerId],
    );
    const snapshot = addr ? {
      recipientName: addr.recipient_name,
      phone: addr.phone,
      addressLine: addr.address_line,
      subDistrict: addr.sub_district,
      district: addr.district,
      province: addr.province,
      postalCode: addr.postal_code,
    } : {};

    const paymentDueAt = new Date(Date.now() + time.paymentDueMs);
    const [res] = await c.query(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, closing_type, item_price, shipping_fee,
                           total_amount, shipping_address, status, payment_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?)`,
      [listingId, buyerId, listing.seller_id, closingType, toDecimal(itemPrice), toDecimal(shippingFee),
        toDecimal(total), JSON.stringify(snapshot), paymentDueAt],
    );
    return { orderId: res.insertId, totalAmount: Number(toDecimal(total)), paymentDueAt: paymentDueAt.toISOString() };
  });
}

module.exports = { create };
