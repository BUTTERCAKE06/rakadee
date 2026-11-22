// Payment Controller (เจ้าของ: SA) — api-spec หัวข้อ 7 
const { ok, created } = require('../utils/response');
const paymentService = require('../services/payment.service');

// 7.3 GET /api/seller/earnings
async function getSellerEarnings(req, res) {
  const data = await paymentService.getSellerEarnings(req.user.id);
  ok(res, data);
}

// 7.4 GET /api/orders/:id/payment
async function getPaymentInfo(req, res) {
  const orderId = Number(req.params.id);
  const data = await paymentService.getPaymentInfo(orderId, req.user.id);
  ok(res, data);
}

// 7.5 PUT /api/orders/:id/shipping-address
async function updateShippingAddress(req, res) {
  const orderId = Number(req.params.id);
  const { addressId } = req.body;
  const data = await paymentService.updateShippingAddress(orderId, req.user.id, addressId);
  ok(res, data);
}

// 7.6 POST /api/orders/:id/pay
async function payWithWallet(req, res) {
  const orderId = Number(req.params.id);
  const data = await paymentService.payWithWallet(orderId, req.user.id);
  created(res, data);
}

// 7.7 POST /api/payments/:id/slip
async function uploadSlip(req, res) {
  const paymentId = Number(req.params.id);
  const data = await paymentService.uploadSlip(paymentId, req.user.id, req.file, req.body);
  ok(res, data);
}

// 7.8 GET /api/admin/payments
async function getAdminPayments(req, res) {
  const { status, page, limit } = req.query;
  const data = await paymentService.getAdminPayments(status, page, limit);
  ok(res, data);
}

// 7.9 GET /api/admin/payments/:id
async function getAdminPaymentDetail(req, res) {
  const paymentId = Number(req.params.id);
  const data = await paymentService.getAdminPaymentDetail(paymentId);
  ok(res, data);
}

// 7.10 POST /api/admin/payments/:id/approve
async function approvePayment(req, res) {
  const paymentId = Number(req.params.id);
  const data = await paymentService.approvePayment(paymentId, req.user.id, req.ip);
  ok(res, data);
}

// 7.11 POST /api/admin/payments/:id/reject
async function rejectPayment(req, res) {
  const paymentId = Number(req.params.id);
  const { reason } = req.body;
  const data = await paymentService.rejectPayment(paymentId, req.user.id, reason, req.ip);
  ok(res, data);
}

module.exports = {
  getSellerEarnings,
  getPaymentInfo,
  updateShippingAddress,
  payWithWallet,
  uploadSlip,
  getAdminPayments,
  getAdminPaymentDetail,
  approvePayment,
  rejectPayment,
};
