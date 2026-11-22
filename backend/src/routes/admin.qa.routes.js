// admin.qa.routes.js — หน้าแอดมินของโมดูล QA: ข้อพิพาท (9.4–9.6), จัดการผู้ใช้/บทลงโทษ (10.1–10.7)
// เจ้าของ: QA · mount ที่ /api/admin โดย routes/index.js
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const disputeCtrl = require('../controllers/dispute.controller');
const userCtrl = require('../controllers/admin.user.controller');

const router = express.Router();
const admin = [requireAuth, requireRole('admin')];
const superAdmin = [requireAuth, requireRole('super_admin')];

// ── ข้อพิพาท ──────────────────────────────────────────────────
router.get('/disputes', ...admin, disputeCtrl.adminList);                    // 9.4
router.patch('/disputes/:id/status', ...admin, disputeCtrl.adminUpdateStatus); // 9.5
router.post('/disputes/:id/resolve', ...admin, disputeCtrl.adminResolve);    // 9.6

// ── จัดการผู้ใช้ ──────────────────────────────────────────────
router.get('/users', ...admin, userCtrl.listUsers);                          // 10.1
router.get('/users/:id', ...admin, userCtrl.getUser);                        // 10.2
router.post('/users/:id/status', ...admin, userCtrl.changeStatus);           // 10.3
router.post('/users/:id/ban', ...admin, userCtrl.banUser);                   // 10.4
router.post('/blacklists/:id/revoke', ...superAdmin, userCtrl.revokeBlacklist); // 10.5

// ── Shill detection ──────────────────────────────────────────
router.get('/suspicious-flags', ...admin, userCtrl.listFlags);               // 10.6
router.post('/suspicious-flags/:id/review', ...admin, userCtrl.reviewFlag);  // 10.7

module.exports = router;
