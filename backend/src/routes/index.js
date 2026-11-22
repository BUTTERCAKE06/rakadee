const express = require('express');
const { pool } = require('../config/db');
const { ok, asyncHandler } = require('../utils/response');

const router = express.Router();

router.get('/health', asyncHandler(async (req, res) => {
  let database = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    database = 'error: ' + err.message;
  }
  ok(res, { status: 'ok', database, serverTime: new Date().toISOString() });
}));

router.use('/auth', require('./auth.routes'));              // SA
router.use('/wallet', require('./wallet.routes'));          // SA
router.use('/payments', require('./payment.routes'));        // SA: 7.7
router.use('/orders', require('./order.payment.routes'));    // SA: 7.4–7.6
router.use('/admin', require('./admin.payment.routes'));    // SA: 7.8–7.11
router.use('/seller', require('./seller.earnings.routes')); // SA: 7.3
// ── QA: เปิดสิทธิ์ผู้ขาย + ลงสินค้า ──────────────────────────────
router.get('/categories', require('../controllers/listing.controller').getCategories);  // 4.1 public
router.use('/seller', require('./seller.routes'));          // QA: 3.1–3.4, 4.9
router.use('/listings', require('./listing.routes'));       // QA: 4.2–4.8  + Programmer (บิด/ค้นหา) (เพิ่ม route ด้านล่างในไฟล์เดียวกัน)
router.use('/admin', require('./admin.listing.routes'));    // QA: 4.10–4.13 (admin listings)
router.use('/admin', require('./admin.seller.routes'));     // QA: 3.5–3.8 (แอดมินตรวจร้าน D-18)
router.use('/admin', require('./admin.qa.routes'));         // QA: 9.4–9.6 (ข้อพิพาท), 10.1–10.7 (จัดการผู้ใช้)
router.get('/sellers/:userId', require('../controllers/seller.controller').getPublicProfile); // 3.4 public + Promgrammer (ดึง api นี้ไปใช้ทำ FE หน้าโปรไฟล์ผู้ขายแบบสาธารณะ)
router.use('/', require('./auction.routes'));                 // Programmer: 5.1–5.7, 6.1–6.7 (route ทั้งหมดอยู่ใน auction.routes.js)
router.use('/', require('./order.routes'));                   // PM: 8.1–8.8 คำสั่งซื้อและการจัดส่ง
router.use('/', require('./dispute.routes'));               // QA: 9.1–9.3 + GET /disputes (/orders/:id/disputes, /disputes/:id)
router.use('/notifications', require('./notification.routes')); // PM: 11.1–11.4
// PM: 11.10 ค่าธรรมเนียมปัจจุบัน (public) ใช้แสดงตัวอย่างรายได้ในหน้าลงสินค้า / ช่วยเหลือ
router.get('/fee-config', asyncHandler(async (req, res) => ok(res, await require('../services/settings').feeConfig())));
router.use('/users', require('./user.routes'));                 // PM: 2.1–2.11
router.use('/admin', require('./admin.routes'));                // PM: 11.5, 11.7 (แต่ละคนเพิ่ม route แอดมินของโมดูลตัวเองแยกไฟล์)

module.exports = router;
