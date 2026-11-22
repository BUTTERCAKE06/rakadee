// Scheduler: กำหนดส่งของผู้ขาย (เจ้าของ: PM) — api-spec หัวข้อ 8 "Scheduler", requirement 6.1
// 1) เหลือ time.shipReminderBeforeMs ก่อน ship_due_at → เตือนผู้ขายครั้งเดียว (SHIP_DUE_SOON)
// 2) เลย ship_due_at แล้วยังไม่ส่ง → แจ้งผู้ซื้อครั้งเดียวว่ายกเลิกได้ (SHIP_OVERDUE) ปุ่มยกเลิกอยู่ที่ 8.6
const shipping = require('../services/shipping.service');

async function run() {
  const reminded = await shipping.remindShipping();
  const overdue = await shipping.notifyOverdue();
  if (reminded || overdue) console.log(`[shippingDeadline] reminded ${reminded}, overdue ${overdue}`);
}

module.exports = { name: 'shippingDeadline', run };
