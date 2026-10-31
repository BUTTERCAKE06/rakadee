// Scheduler (node-cron) รันทุก job ในโฟลเดอร์นี้ตาม time.cronSchedule (ค่าเริ่มต้นทุก 1 นาที)
// เพิ่ม job ใหม่: สร้างไฟล์ในโฟลเดอร์นี้ แล้ว export { name, run }
//   module.exports = { name: 'closeAuctions', run: async () => { ... } };
// job ที่วางแผนไว้: closeAuctions (Programmer), paymentReminder, paymentTimeout (SA),
// shippingDeadline, autoRelease (PM), restoreStatus (QA)
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const time = require('../config/time');

function loadJobs() {
  return fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => require(path.join(__dirname, f)))
    .filter((job) => job && typeof job.run === 'function');
}

function startJobs() {
  const jobs = loadJobs();
  const running = new Set();

  cron.schedule(time.cronSchedule, async () => {
    for (const job of jobs) {
      if (running.has(job.name)) continue; // กันรอบก่อนยังไม่จบ
      running.add(job.name);
      try {
        await job.run();
      } catch (err) {
        console.error(`[job:${job.name}]`, err);
      } finally {
        running.delete(job.name);
      }
    }
  });

  console.log(`Scheduler started: ${jobs.map((j) => j.name).join(', ') || '(no jobs yet)'}`);
}

module.exports = { startJobs };
