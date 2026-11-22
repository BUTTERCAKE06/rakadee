// dispute.routes.js — ข้อพิพาทฝั่งสมาชิก (api-spec 9.1–9.3) เจ้าของ: QA
// mount ที่ /api โดย routes/index.js (มีทั้ง /orders/:id/disputes และ /disputes/:id)
const express = require('express');
const { requireAuth, requireRole, requireActiveAccount } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const ctrl = require('../controllers/dispute.controller');

const router = express.Router();
const MAX_FILES = 5;

// 9.1 ผู้ซื้อของ Order (action pay) — ตรวจความเป็นผู้ซื้อใน service
router.post(
  '/orders/:id/disputes',
  requireAuth,
  requireRole('member'),
  requireActiveAccount('pay'),
  upload('evidence').array('files', MAX_FILES),
  ctrl.openDispute,
);

// ข้อพิพาทของฉัน (เพิ่มจาก spec สำหรับเมนู "ข้อพิพาท" ของผู้ขาย) — ต้องอยู่ก่อน /disputes/:id
router.get('/disputes', requireAuth, requireRole('member'), ctrl.listMine);

// 9.2 ผู้ซื้อ/ผู้ขายของ Order หรือแอดมิน — ตรวจสิทธิ์ใน service
router.get('/disputes/:id', requireAuth, ctrl.getDispute);

// 9.7 ไฟล์รูปหลักฐาน (ตรวจสิทธิ์เหมือน 9.2)
router.get('/disputes/:id/evidence/:evidenceId', requireAuth, ctrl.getEvidenceFile);

// 9.3 ผู้ซื้อ/ผู้ขายของ Order
router.post(
  '/disputes/:id/evidence',
  requireAuth,
  requireRole('member'),
  upload('evidence').array('files', MAX_FILES),
  ctrl.addEvidence,
);

module.exports = router;
