// admin.seller.routes.js — แอดมินตรวจคำขอเปิดร้าน (api-spec 3.5–3.8, D-18)
// เจ้าของ: QA · mount ที่ /api/admin โดย routes/index.js
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/seller.controller');

const router = express.Router();
const admin = [requireAuth, requireRole('admin')];

router.get('/seller-applications', ...admin, ctrl.listApplications);                      // 3.5
router.get('/seller-applications/:userId', ...admin, ctrl.getApplication);               // 3.6
router.post('/seller-applications/:userId/approve', ...admin, ctrl.approveApplication);  // 3.7
router.post('/seller-applications/:userId/reject', ...admin, ctrl.rejectApplication);    // 3.8

module.exports = router;
