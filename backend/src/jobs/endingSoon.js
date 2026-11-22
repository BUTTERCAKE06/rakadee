// Scheduler job: แจ้งเตือน "ใกล้หมดเวลา" (เจ้าของ: Programmer) — requirement ข้อ 4 แจ้งเตือน, api-spec 11
// รันทุก time.cronSchedule จาก jobs/index.js ระยะ "ใกล้หมดเวลา" อ่านจาก time.endingSoonMs (ค่าเริ่มต้น 60 นาที)
// ผู้รับ: คนใน Watchlist และคนที่เคยบิด กันส่งซ้ำด้วยคอลัมน์ในฐานข้อมูล (ดู auction.service.notifyEndingSoon())
const { notifyEndingSoon } = require('../services/auction.service');

async function run() {
  const res = await notifyEndingSoon();
  if (res.watchers || res.bidders) {
    console.log(`[endingSoon] notified watchers=${res.watchers} bidders=${res.bidders}`);
  }
}

module.exports = { name: 'endingSoon', run };
