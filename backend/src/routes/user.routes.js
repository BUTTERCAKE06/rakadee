// Settings (เจ้าของ: PM) — api-spec 2.1–2.11 · mount ที่ /api/users
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { ok, created, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const service = require('../services/user.service');

const router = express.Router();
const member = [requireAuth, requireRole('member')];

// 2.11 ข้อมูลสาธารณะ (public)
router.get('/:id(\\d+)/public', asyncHandler(async (req, res) => {
  ok(res, await service.getPublicUser(parseId(req.params.id)));
}));

// 2.1 แก้ชื่อที่แสดง / คำแนะนำตัว
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  ok(res, await service.updateProfile(req.user.id, req.body));
}));

// 2.2 / 2.3 รูปโปรไฟล์ (field: avatar)
router.post('/me/avatar', requireAuth, upload('avatars').single('avatar'), asyncHandler(async (req, res) => {
  ok(res, await service.setAvatar(req.user.id, req.file));
}));
router.delete('/me/avatar', requireAuth, asyncHandler(async (req, res) => {
  ok(res, await service.removeAvatar(req.user.id));
}));

// 2.4–2.8 สมุดที่อยู่
router.get('/me/addresses', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.listAddresses(req.user.id));
}));
router.post('/me/addresses', ...member, asyncHandler(async (req, res) => {
  created(res, await service.createAddress(req.user.id, req.body));
}));
router.put('/me/addresses/:id', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.updateAddress(req.user.id, parseId(req.params.id), req.body));
}));
router.delete('/me/addresses/:id', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.deleteAddress(req.user.id, parseId(req.params.id)));
}));
router.post('/me/addresses/:id/default', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.setDefaultAddress(req.user.id, parseId(req.params.id)));
}));

// 2.9 / 2.10 ตั้งค่าแจ้งเตือน
router.get('/me/notification-settings', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.getNotificationSettings(req.user.id));
}));
router.put('/me/notification-settings', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.updateNotificationSettings(req.user.id, req.body));
}));

module.exports = router;
