// คำสั่งซื้อและการจัดส่ง (เจ้าของ: PM) — api-spec หัวข้อ 8 · mount ที่ /api ด้วย path เต็ม
// (มี /seller/shipments และ /admin/orders ด้วย จึงไม่ mount ใต้ /orders)
const express = require('express');
const { requireAuth, requireRole, requireActiveAccount } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { ok, created, asyncHandler } = require('../utils/response');
const pagination = require('../utils/pagination');
const parseId = require('../utils/parseId');
const service = require('../services/shipping.service');

const router = express.Router();
const member = [requireAuth, requireRole('member')];

// 8.1 คำสั่งซื้อของฉัน (?role=buyer|seller&status=&page=)
router.get('/orders', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.listMyOrders(req.user, { role: req.query.role, status: req.query.status, ...pagination(req.query) }));
}));

// 8.2 รายละเอียด + ไทม์ไลน์ (ผู้ซื้อ ผู้ขาย หรือแอดมิน)
router.get('/orders/:id', requireAuth, asyncHandler(async (req, res) => {
  ok(res, await service.getOrder(req.user, parseId(req.params.id)));
}));

// 8.8 ไฟล์หลักฐานการจัดส่ง (ตรวจสิทธิ์เหมือน 8.2)
router.get('/orders/:id/shipment/proof', requireAuth, asyncHandler(async (req, res) => {
  res.sendFile(await service.getProofFile(req.user, parseId(req.params.id)));
}));

// 8.4 บันทึกการจัดส่ง (multipart: proof ไม่บังคับ)
router.post('/orders/:id/shipment', requireAuth, requireRole('seller'), requireActiveAccount('pay'),
  upload('shipments').single('proof'),
  asyncHandler(async (req, res) => {
    created(res, await service.recordShipment(req.user, parseId(req.params.id), req.body, req.file));
  }));

// 8.5 ยืนยันรับสินค้า → ปล่อยเงิน
router.post('/orders/:id/confirm-receipt', ...member, requireActiveAccount('pay'), asyncHandler(async (req, res) => {
  ok(res, await service.confirmReceipt(req.user, parseId(req.params.id)));
}));

// 8.6 ขอยกเลิกเมื่อผู้ขายไม่ส่งเกินกำหนด
router.post('/orders/:id/cancel', ...member, asyncHandler(async (req, res) => {
  ok(res, await service.cancelForNoShipment(req.user, parseId(req.params.id), req.body));
}));

// 8.3 รายการรอจัดส่งของผู้ขาย
router.get('/seller/shipments', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  ok(res, await service.listPendingShipments(req.user));
}));

// 8.7 คำสั่งซื้อทั้งหมด (แอดมิน) ?status=&q=&page=
router.get('/admin/orders', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  ok(res, await service.listAllOrders({ status: req.query.status, q: req.query.q, ...pagination(req.query) }));
}));

module.exports = router;
