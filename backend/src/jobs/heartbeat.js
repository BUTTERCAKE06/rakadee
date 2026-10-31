// ตัวอย่าง job: ยืนยันว่า Scheduler ทำงาน (ลบได้เมื่อมี job จริงแล้ว)
module.exports = {
  name: 'heartbeat',
  run: async () => {
    if (process.env.NODE_ENV !== 'production') console.log(`[job:heartbeat] ${new Date().toISOString()}`);
  },
};
