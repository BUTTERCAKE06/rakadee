// Admin Dashboard + Audit Log (เจ้าของ: PM) — api-spec 11.5–11.7 · mount ที่ /api/admin
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { ok, asyncHandler } = require('../utils/response');
const pagination = require('../utils/pagination');
const service = require('../services/admin.service');

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

module.exports = router;
