// Scheduler job: เตือนผู้ซื้อเมื่อเหลือเวลาชำระเงิน 24 ชม. (เจ้าของ: SA) — api-spec 7 
const { pool } = require('../config/db');
const time = require('../config/time');
const { notify, EVENTS } = require('../services/notify');

async function run() {
  const reminderThreshold = new Date(Date.now() - time.paymentReminderMs);

  // หา Order ที่รอชำระ, ผ่านเวลา reminder ไปแล้ว, ยังไม่เคยแจ้งเตือน, และไม่มี payment ที่กำลังรอตรวจ
  const [orders] = await pool.query(
    `SELECT o.id, o.buyer_id, o.listing_id
     FROM orders o
     WHERE o.status = 'pending_payment'
       AND o.payment_reminded_at IS NULL
       AND o.created_at <= ?
       AND NOT EXISTS (
         SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'pending_review'
       )
     LIMIT 50`,
    [reminderThreshold]
  );

  for (const o of orders) {
    try {
      await pool.query('UPDATE orders SET payment_reminded_at = UTC_TIMESTAMP() WHERE id = ?', [o.id]);
      await notify(o.buyer_id, EVENTS.PAYMENT_DUE_SOON, {
        orderId: o.id,
        listingId: o.listing_id,
      });
      console.log(`[paymentReminder] order #${o.id} reminded to buyer #${o.buyer_id}`);
    } catch (err) {
      console.error(`[paymentReminder] order #${o.id} error:`, err.message);
    }
  }
}

module.exports = {
  name: 'paymentReminder',
  run,
};
