// Payment Routes (เจ้าของ: SA) — api-spec 7.7
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/response');
const upload = require('../middlewares/upload');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// 7.7 POST /api/payments/:id/slip — แนบสลิป
router.post(
  '/:id/slip',
  requireAuth,
  upload('slips').single('slip'),
  asyncHandler(paymentController.uploadSlip)
);

module.exports = router;
