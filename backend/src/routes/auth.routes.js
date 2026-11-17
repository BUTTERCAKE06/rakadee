// Auth Routes ใน docs/api-spec/api-spec.md (เจ้าของ: SA)
const express = require('express');
const { asyncHandler } = require('../utils/response');
const { requireAuth } = require('../middlewares/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// 1.1 ข้อกำหนดและนโยบายความเป็นส่วนตัว (public)
router.get('/terms', asyncHandler(authController.getTerms));

// 1.2 สมัครสมาชิก (public)
router.post('/register', asyncHandler(authController.register));

// 1.3 ยืนยัน OTP (public)
router.post('/otp/verify', asyncHandler(authController.verifyOtp));

// 1.4 ขอ OTP ใหม่ (public)
router.post('/otp/resend', asyncHandler(authController.resendOtp));

// 1.5 เข้าสู่ระบบ (public)
router.post('/login', asyncHandler(authController.login));

// 1.6 ออกจากระบบ (login)
router.post('/logout', requireAuth, asyncHandler(authController.logout));

// 1.7 ข้อมูลผู้ใช้ปัจจุบัน (login)
router.get('/me', requireAuth, asyncHandler(authController.getMe));

// 1.8 ยืนยันอีเมลจากลิงก์ (public)
router.post('/email/verify', asyncHandler(authController.verifyEmail));

// 1.9 ส่งลิงก์ยืนยันอีเมลใหม่ (login)
router.post('/email/resend', requireAuth, asyncHandler(authController.resendEmailVerify));

// 1.10 ขอลิงก์รีเซ็ตรหัสผ่าน (public)
router.post('/password/forgot', asyncHandler(authController.forgotPassword));

// 1.11 ตั้งรหัสผ่านใหม่จากลิงก์ (public)
router.post('/password/reset', asyncHandler(authController.resetPassword));

// 1.12 เปลี่ยนรหัสผ่าน (login)
router.post('/password/change', requireAuth, asyncHandler(authController.changePassword));

// 1.13 ดูรายการอุปกรณ์ที่เคยเข้าสู่ระบบ (login)
router.get('/sessions', requireAuth, asyncHandler(authController.getSessions));

// 1.14 ออกจากระบบอุปกรณ์อื่น (login)
router.delete('/sessions/:id', requireAuth, asyncHandler(authController.revokeSession));

module.exports = router;
