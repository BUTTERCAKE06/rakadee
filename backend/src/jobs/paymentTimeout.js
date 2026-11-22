// Scheduler job: ยกเลิกคำสั่งซื้อเมื่อหมดเวลาชำระเงิน 48 ชม. (เจ้าของ: SA) — D-04, api-spec 7
const { pool, withTransaction } = require('../config/db');

async function run() {
  // หา Order ที่เลยกำหนด payment_due_at และไม่มี payment สถานะ pending_review
  const [orders] = await pool.query(
    `SELECT o.id, o.buyer_id, o.seller_id, o.listing_id
     FROM orders o
     WHERE o.status = 'pending_payment'
       AND o.payment_due_at <= UTC_TIMESTAMP()
       AND NOT EXISTS (
         SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'pending_review'
       )
     LIMIT 50`
  );

  for (const o of orders) {
    try {
      await withTransaction(async (conn) => {
        // อัปเดตสถานะ Order เป็น cancelled
        await conn.query(
          `UPDATE orders
           SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), cancel_reason = 'payment_timeout'
           WHERE id = ? AND status = 'pending_payment'`,
          [o.id]
        );
      });

      // เรียก penalty (QA) ถ้ามี service นี้
      try {
        const penalty = require('../services/penalty');
        if (penalty && typeof penalty.add === 'function') {
          await penalty.add(o.buyer_id, 'non_payment', { orderId: o.id });
        }
      } catch {
        // ถ้า QA ยังไม่ได้สร้าง penalty service จะไม่ทำให้ job ล้ม
      }

      console.log(`[paymentTimeout] order #${o.id} cancelled due to payment timeout (buyer #${o.buyer_id})`);
    } catch (err) {
      console.error(`[paymentTimeout] order #${o.id} error:`, err.message);
    }
  }
}

module.exports = {
  name: 'paymentTimeout',
  run,
};
