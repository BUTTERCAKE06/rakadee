// Scheduler: ปล่อยเงินอัตโนมัติ (เจ้าของ: PM) — api-spec หัวข้อ 8 "Scheduler", requirement 5.3, 6.3
// Order shipped ที่ครบ auto_release_at และไม่มีข้อพิพาทเปิด → escrow.release() (Order completed)
// ปิดทีละรายการใน transaction ของตัวเอง รายการไหนล้มรายการอื่นยังทำต่อ
const shipping = require('../services/shipping.service');

async function run() {
  const ids = await shipping.dueForAutoRelease();
  for (const id of ids) {
    try {
      const res = await shipping.autoReleaseOne(id);
      if (res) console.log(`[autoRelease] order ${id} released (fee ${res.feeAmount})`);
    } catch (err) {
      console.error(`[autoRelease] order ${id} failed:`, err.message);
    }
  }
}

module.exports = { name: 'autoRelease', run };
