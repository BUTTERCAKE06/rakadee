// Order Payment Routes (เจ้าของ: SA) — api-spec 7.4, 7.5, 7.6
const express = require('express');
const { requireAuth, requireActiveAccount } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/response');
const upload = require('../middlewares/upload');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// 7.4 GET /api/orders/:id/payment — ข้อมูลหน้าชำระเงิน
router.get(
  '/:id/payment',
  requireAuth,
  asyncHandler(paymentController.getPaymentInfo)
);

// 7.5 PUT /api/orders/:id/shipping-address — เปลี่ยนที่อยู่จัดส่ง (ก่อนชำระเท่านั้น)
router.put(
  '/:id/shipping-address',
  requireAuth,
  asyncHandler(paymentController.updateShippingAddress)
);

// 7.6 POST /api/orders/:id/pay — ชำระด้วย Mock Wallet (D-01)
router.post(
  '/:id/pay',
  requireAuth,
  requireActiveAccount('pay'),
  upload('slips').single('slip'), // บังคับแนบสลิปพร้อมชำระ
  asyncHandler(paymentController.payWithWallet)
);

module.exports = router;
