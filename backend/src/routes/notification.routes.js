// แจ้งเตือน (เจ้าของ: PM) — api-spec 11.1–11.4 · mount ที่ /api/notifications
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { ok, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const pagination = require('../utils/pagination');
const service = require('../services/notification.service');

const router = express.Router();
router.use(requireAuth);

// 11.1 รายการแจ้งเตือน (?unread=true&group=auction|finance|shipping)
router.get('/', asyncHandler(async (req, res) => {
  ok(res, await service.list(req.user.id, { ...req.query, ...pagination(req.query) }));
}));

// 11.2 จำนวนที่ยังไม่อ่าน
router.get('/unread-count', asyncHandler(async (req, res) => {
  ok(res, { unreadCount: await service.unreadCount(req.user.id) });
}));

// 11.4 อ่านทั้งหมด (ต้องอยู่ก่อน /:id/read)
router.post('/read-all', asyncHandler(async (req, res) => {
  ok(res, await service.markAllRead(req.user.id));
}));

// 11.3 อ่านแล้ว
router.post('/:id/read', asyncHandler(async (req, res) => {
  ok(res, await service.markRead(req.user.id, parseId(req.params.id)));
}));

module.exports = router;
