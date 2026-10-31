// รวม router ทุกโมดูลไว้ที่นี่ ทุก route อยู่ใต้ /api
// เพิ่มโมดูลใหม่: สร้างไฟล์ src/routes/<module>.routes.js แล้ว router.use() ด้านล่าง
const express = require('express');
const { ok, asyncHandler } = require('../utils/response');
const db = require('../config/db');

const router = express.Router();

router.get('/health', asyncHandler(async (req, res) => {
  let database = 'ok';
  try {
    await db.ping();
  } catch {
    database = 'unavailable';
  }
  ok(res, { status: 'ok', database, serverTime: new Date().toISOString() });
}));

// router.use('/auth', require('./auth.routes'));          // SA
// router.use('/wallet', require('./wallet.routes'));      // SA
// router.use('/payments', require('./payment.routes'));   // SA
// router.use('/listings', require('./listing.routes'));   // QA (ลงสินค้า) + Programmer (บิด/ค้นหา)
// router.use('/orders', require('./order.routes'));       // PM (จัดส่ง)
// router.use('/disputes', require('./dispute.routes'));   // QA
// router.use('/notifications', require('./notification.routes')); // PM
// router.use('/admin', require('./admin.routes'));        // แต่ละคนเพิ่ม route แอดมินของโมดูลตัวเอง

module.exports = router;
