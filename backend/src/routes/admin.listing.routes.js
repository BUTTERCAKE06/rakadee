// admin.listing.routes.js — admin: อนุมัติ/ปฏิเสธสินค้า (api-spec 4.10–4.13)
// เจ้าของ: QA
// mount ที่ /api/admin โดย routes/index.js
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const adminListingCtrl = require('../controllers/admin.listing.controller');

const router = express.Router();

// 4.10 GET  /api/admin/listings           — รายการ (ค่าเริ่มต้น pending_review)
router.get('/listings', requireAuth, requireRole('admin'), adminListingCtrl.listListings);

// 4.11 GET  /api/admin/listings/:id       — รายละเอียดเต็ม
router.get('/listings/:id', requireAuth, requireRole('admin'), adminListingCtrl.getListing);

// 4.12 POST /api/admin/listings/:id/approve — อนุมัติ
router.post('/listings/:id/approve', requireAuth, requireRole('admin'), adminListingCtrl.approveListing);

// 4.13 POST /api/admin/listings/:id/reject  — ปฏิเสธ (บังคับเหตุผล)
router.post('/listings/:id/reject', requireAuth, requireRole('admin'), adminListingCtrl.rejectListing);

module.exports = router;
