// Seller Earnings Routes (เจ้าของ: SA) — api-spec 7.3
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/response');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// 7.3 GET /api/seller/earnings — รายได้แยกรายการ + ค่าธรรมเนียม
router.get(
  '/earnings',
  requireAuth,
  requireRole('seller'),
  asyncHandler(paymentController.getSellerEarnings)
);

module.exports = router;
