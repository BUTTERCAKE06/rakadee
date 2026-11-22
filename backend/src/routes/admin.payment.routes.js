// Admin Payment Routes (เจ้าของ: SA) — api-spec 7.8–7.11
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/response');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// 7.8 GET /api/admin/payments — รายการรอตรวจ (?status=pending_review)
router.get(
  '/payments',
  requireAuth,
  requireRole('admin', 'super_admin'),
  asyncHandler(paymentController.getAdminPayments)
);

// 7.9 GET /api/admin/payments/:id — รายละเอียดการชำระ + Order
router.get(
  '/payments/:id',
  requireAuth,
  requireRole('admin', 'super_admin'),
  asyncHandler(paymentController.getAdminPaymentDetail)
);

// 7.10 POST /api/admin/payments/:id/approve — อนุมัติ → Escrow
router.post(
  '/payments/:id/approve',
  requireAuth,
  requireRole('admin', 'super_admin'),
  asyncHandler(paymentController.approvePayment)
);

// 7.11 POST /api/admin/payments/:id/reject — ปฏิเสธ → คืนเงิน (บังคับเหตุผล)
router.post(
  '/payments/:id/reject',
  requireAuth,
  requireRole('admin', 'super_admin'),
  asyncHandler(paymentController.rejectPayment)
);

module.exports = router;
