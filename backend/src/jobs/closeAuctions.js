// Scheduler job: ปิดประมูลที่ถึงเวลา (เจ้าของ: Programmer) — api-spec หัวข้อ 6 "Scheduler closeAuctions", ข้อ 4.5
// รันทุก time.cronSchedule (ค่าเริ่มต้นทุก 1 นาที) จาก jobs/index.js
// หา listing ที่ status = active และ end_at <= now แล้วปิดทีละรายการใน transaction ของตัวเอง
// ผล: no_bid / below_reserve / has_winner (+ order.create) ส่วน buy_now ปิดไปแล้วตอนกดซื้อ
const db = require('../config/db');
const { closeListing } = require('../services/auction.service');

const BATCH = 50; // กันรอบเดียวทำนานเกินไป ที่เหลือไปรอบถัดไป

async function run() {
  const [rows] = await db.query(
    `SELECT id FROM listings WHERE status = 'active' AND end_at <= UTC_TIMESTAMP() ORDER BY end_at ASC LIMIT ?`,
    [BATCH],
  );
  for (const { id } of rows) {
    try {
      const res = await closeListing(id);
      if (res) console.log(`[closeAuctions] listing ${id} -> ${res.result}`);
    } catch (err) {
      console.error(`[closeAuctions] listing ${id} failed:`, err.message); // รายการอื่นยังปิดต่อได้
    }
  }
}

module.exports = { name: 'closeAuctions', run };
