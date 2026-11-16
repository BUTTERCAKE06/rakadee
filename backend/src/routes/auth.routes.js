// Auth (เจ้าของ: SA) — api-spec หัวข้อ 1 · mount ที่ /api/auth
// PM ใส่ไว้ก่อนเฉพาะ 1.6 logout และ 1.7 me เพราะ navbar และทุกหน้าที่ต้อง login ใช้
// SA เพิ่ม register / OTP / login / password / sessions ต่อในไฟล์นี้ได้เลย
const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middlewares/auth');
const { ok, asyncHandler } = require('../utils/response');
const userService = require('../services/user.service');

const router = express.Router();

// 1.6 ออกจากระบบ (session นี้)
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await db.pool.query('UPDATE sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ?', [req.user.sessionId]);
  ok(res, { loggedOut: true });
}));

// 1.7 ข้อมูลผู้ใช้ปัจจุบัน (UserMe)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  ok(res, await userService.getMe(req.user.id));
}));

module.exports = router;
