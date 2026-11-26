// Admin Dashboard + Audit Log + ตั้งค่าระบบ + Bid Log (เจ้าของ: PM) — api-spec 11.5–11.9, 11.11–11.12 · mount ที่ /api/admin
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { ok, asyncHandler } = require('../utils/response');
const pagination = require('../utils/pagination');
const service = require('../services/admin.service');
const settings = require('../services/settings');

const router = express.Router();
const admin = [requireAuth, requireRole('admin')];

// 11.5 สถิติภาพรวม
router.get('/dashboard', ...admin, asyncHandler(async (req, res) => {
  ok(res, await service.getDashboard());
}));

// 11.6 ข้อมูลกราฟ (?range=7d|30d|90d&group=day|week)
router.get('/dashboard/charts', ...admin, asyncHandler(async (req, res) => {
  ok(res, await service.getCharts(req.query));
}));

// 11.7 Audit Log (?adminId=&action=&targetType=&from=YYYY-MM-DD&to=YYYY-MM-DD&sort=newest|oldest|admin|action&page=)
router.get('/audit-logs', ...admin, asyncHandler(async (req, res) => {
  ok(res, await service.listAuditLogs(req.user, { ...req.query, ...pagination(req.query) }));
}));

// 11.11 Bid Log: ใครบิดอะไร (?categoryId=&q=&listingId=&bidderId=&type=manual|auto|buy_now&from=&to=&page=)
router.get('/bids', ...admin, asyncHandler(async (req, res) => {
  ok(res, await service.listBids({ ...req.query, ...pagination(req.query) }));
}));

// 11.12 ผลการประมูล: ใครชนะอะไร (?categoryId=&q=&result=has_winner|buy_now|below_reserve|no_bid&from=&to=&page=)
router.get('/auction-results', ...admin, asyncHandler(async (req, res) => {
  ok(res, await service.listAuctionResults({ ...req.query, ...pagination(req.query) }));
}));

// 11.8 / 11.9 ตั้งค่าระบบ (Super Admin เท่านั้น)
const superAdmin = [requireAuth, requireRole('super_admin')];
router.get('/settings', ...superAdmin, asyncHandler(async (req, res) => {
  ok(res, await settings.list());
}));
router.put('/settings', ...superAdmin, asyncHandler(async (req, res) => {
  ok(res, await settings.update(req.user, req.body && req.body.settings, req.ip));
}));

module.exports = router;
