// Interface กลาง dispute.isOpen(orderId) (เจ้าของ: QA) — ใช้โดย SA (escrow.release) และ PM (autoRelease)
//   const dispute = require('./dispute');
//   if (await dispute.isOpen(orderId)) { ...ข้าม... }
// พารามิเตอร์ที่ 2 (ไม่บังคับ) = connection ของ transaction ที่กำลังทำอยู่
const { isOpen } = require('./dispute.service');

module.exports = { isOpen };
