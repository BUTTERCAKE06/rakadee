// ระยะเวลาทั้งหมดของระบบ (ตาม 1.6 ค่าเริ่มต้น และ Decision Log D-02)
// ค่าใน .env เป็น "นาที" เพื่อให้ QA ย่อเวลาได้ตอนทดสอบ เช่น PAYMENT_DUE_MINUTES=5
// ทุก Scheduler job และทุกโมดูลต้องอ่านเวลาจากไฟล์นี้เท่านั้น ห้าม hard-code
require('./index');

const minutes = (name, fallback) => Number(process.env[name]) || fallback;
const MIN = 60 * 1000;

const time = {
  paymentDueMs: minutes('PAYMENT_DUE_MINUTES', 48 * 60) * MIN, // 48 ชม. ชำระเงิน
  paymentReminderMs: minutes('PAYMENT_REMINDER_MINUTES', 24 * 60) * MIN, // แจ้งเตือนเมื่อผ่านไป 24 ชม.
  adminPaymentReviewMs: minutes('ADMIN_REVIEW_MINUTES', 24 * 60) * MIN, // แอดมินตรวจภายใน 24 ชม.
  shippingDueMs: minutes('SHIPPING_DUE_MINUTES', 72 * 60) * MIN, // ผู้ขายส่งภายใน 72 ชม.
  autoReleaseMs: minutes('AUTO_RELEASE_MINUTES', 7 * 24 * 60) * MIN, // ปล่อยเงินเมื่อครบ 7 วัน
  suspendMs: minutes('SUSPEND_MINUTES', 7 * 24 * 60) * MIN, // ระงับชั่วคราว 7 วัน
  autoExtendMs: minutes('AUTO_EXTEND_MINUTES', 2) * MIN, // Auto Extend 2 นาที
  autoExtendMaxCount: Number(process.env.AUTO_EXTEND_MAX_COUNT) || 10,
  auctionDurationsDays: [1, 3, 7],
  otpExpireMs: minutes('OTP_EXPIRE_MINUTES', 5) * MIN,
  passwordResetExpireMs: minutes('PASSWORD_RESET_MINUTES', 30) * MIN,
  cronSchedule: process.env.CRON_SCHEDULE || '* * * * *', // ทุก 1 นาที
};

module.exports = time;
