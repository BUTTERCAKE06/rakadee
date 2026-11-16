// Audit Log (เจ้าของ: PM) ข้อ 8.2-6 — ทุกการกระทำของแอดมินต้องเรียกฟังก์ชันนี้หลังทำสำเร็จ
// ตัวอย่าง: await audit.log(req.user.id, 'LISTING_APPROVE', 'listing', 1234, req.ip);
// action ที่ใช้ (api-spec หัวข้อ 11): LISTING_APPROVE, LISTING_REJECT, PAYMENT_APPROVE, PAYMENT_REJECT,
//   DISPUTE_STATUS, DISPUTE_RESOLVE, USER_STATUS, USER_BAN, BLACKLIST_REVOKE, FLAG_REVIEW, SETTING_UPDATE
// ถ้าบันทึกไม่สำเร็จจะ log ไว้และไม่ throw เพื่อไม่ให้งานหลักของแอดมินล้ม
const db = require('../config/db');

/**
 * @param {number} adminId
 * @param {string} action
 * @param {string} targetType เช่น listing, order, payment, user, dispute, setting
 * @param {number|string} targetId
 * @param {string} ip
 * @param {object} [detail] ข้อมูลประกอบ เช่น { reason } (ไม่บังคับ)
 */
async function log(adminId, action, targetType, targetId, ip, detail) {
  try {
    await db.pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, action, targetType, String(targetId), detail ? JSON.stringify(detail) : null, ip || 'unknown'],
    );
  } catch (err) {
    console.error(`[audit] ${action} ${targetType}:${targetId} failed:`, err.message);
  }
}

module.exports = { log };
