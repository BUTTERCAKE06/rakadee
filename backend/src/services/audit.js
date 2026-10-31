// Audit Log (เจ้าของ: PM) ข้อ 8.2-6
// ทุกการกระทำของแอดมินต้องเรียกฟังก์ชันนี้
// ตอนนี้เป็น STUB: log ลง console ของจริงจะบันทึกลงตาราง admin_audit_logs
//
// ตัวอย่าง: await audit.log(req.user.id, 'LISTING_APPROVE', 'listing', 1234, req.ip);

/**
 * @param {number} adminId
 * @param {string} action เช่น LISTING_APPROVE, LISTING_REJECT, PAYMENT_APPROVE, USER_BAN
 * @param {string} targetType เช่น listing, order, payment, user, dispute
 * @param {number|string} targetId
 * @param {string} ip
 */
async function log(adminId, action, targetType, targetId, ip) {
  console.log(`[audit:stub] admin=${adminId} action=${action} target=${targetType}:${targetId} ip=${ip}`);
}

module.exports = { log };
