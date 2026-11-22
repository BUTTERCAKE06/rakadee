// Scheduler job: แจ้งเตือน "ใกล้หมดเวลา" (เจ้าของ: Programmer) — requirement ข้อ 4 แจ้งเตือน, api-spec 11
// รันทุก time.cronSchedule จาก jobs/index.js ระยะ "ใกล้หมดเวลา" อ่านจาก time.endingSoonMs (ค่าเริ่มต้น 60 นาที)
// ผู้รับ: คนใน Watchlist และคนที่เคยบิด รายละเอียดการกันส่งซ้ำอยู่ใน auction.service.notifyEndingSoon()
const { notifyEndingSoon } = require('../services/auction.service');

let lastRunMs = null; // เวลารอบก่อน ใช้หาสินค้าที่เพิ่งเข้าช่วงใกล้หมดเวลา (สำหรับคนที่เคยบิด)

async function run() {
  const nowMs = Date.now();
  const res = await notifyEndingSoon({ sinceMs: lastRunMs, nowMs });
  lastRunMs = nowMs;
  if (res.watchers || res.bidders) {
    console.log(`[endingSoon] notified watchers=${res.watchers} bidders=${res.bidders}`);
  }
}

module.exports = { name: 'endingSoon', run };
