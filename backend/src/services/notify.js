// Notification Service (เจ้าของ: PM)
// ตอนนี้เป็น STUB: log ลง console อย่างเดียว ลายเซ็นฟังก์ชันนี้คงที่ เรียกใช้ได้เลย
// ของจริงจะ: บันทึกลงตาราง notifications, push ผ่าน Socket ไปที่ user:<id>,
// และส่งอีเมลผ่าน SMTP ตาม notification_settings ของผู้ใช้
//
// event ที่ใช้ได้ (ข้อ 7 การแจ้งเตือน):
const EVENTS = Object.freeze({
  ACCOUNT_VERIFY: 'ACCOUNT_VERIFY', // อีเมลเท่านั้น
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  OUTBID: 'OUTBID',
  AUCTION_EXTENDED: 'AUCTION_EXTENDED',
  AUCTION_WON: 'AUCTION_WON',
  AUCTION_LOST: 'AUCTION_LOST',
  AUCTION_ENDING_SOON: 'AUCTION_ENDING_SOON',
  PAYMENT_DUE_SOON: 'PAYMENT_DUE_SOON',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  SHIPPED: 'SHIPPED',
  FUNDS_RELEASED: 'FUNDS_RELEASED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  REFUNDED: 'REFUNDED',
});

/**
 * @param {number} userId ผู้รับ
 * @param {string} event หนึ่งใน EVENTS
 * @param {object} data ข้อมูลประกอบ เช่น { listingId, orderId, amount }
 */
async function notify(userId, event, data = {}) {
  if (!EVENTS[event]) throw new Error(`Unknown notification event: ${event}`);
  console.log(`[notify:stub] user=${userId} event=${event}`, data);
}

module.exports = { notify, EVENTS };
