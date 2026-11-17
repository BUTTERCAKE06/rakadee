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

router.use('/auth', require('./auth.routes'));              // SA (PM ใส่ /me และ /logout ไว้ก่อน)
// router.use('/wallet', require('./wallet.routes'));      // SA
// router.use('/payments', require('./payment.routes'));   // SA
// ── QA: เปิดสิทธิ์ผู้ขาย + ลงสินค้า ──────────────────────────────
router.get('/categories', require('../controllers/listing.controller').getCategories);  // 4.1 public
router.use('/seller', require('./seller.routes'));          // QA: 3.1–3.4, 4.9
router.use('/listings', require('./listing.routes'));       // QA: 4.2–4.8  + Programmer (บิด/ค้นหา) (เพิ่ม route ด้านล่างในไฟล์เดียวกัน)
router.use('/admin', require('./admin.listing.routes'));    // QA: 4.10–4.13 (admin listings)
router.get('/sellers/:userId', require('../controllers/seller.controller').getPublicProfile); // 3.4 public + Promgrammer (ดึง api นี้ไปใช้ทำ FE หน้าโปรไฟล์ผู้ขายแบบสาธารณะ)
router.use('/', require('./auction.routes'));                 // Programmer: 5.1–5.7, 6.1–6.7 (route ทั้งหมดอยู่ใน auction.routes.js)
// router.use('/orders', require('./order.routes'));       // PM (จัดส่ง)
// router.use('/disputes', require('./dispute.routes'));   // QA
router.use('/notifications', require('./notification.routes')); // PM: 11.1–11.4
router.use('/users', require('./user.routes'));                 // PM: 2.1–2.11
router.use('/admin', require('./admin.routes'));                // PM: 11.5, 11.7 (แต่ละคนเพิ่ม route แอดมินของโมดูลตัวเองแยกไฟล์)

module.exports = router;
