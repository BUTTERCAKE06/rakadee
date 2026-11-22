// seller.controller.js — เปิดสิทธิ์ผู้ขาย + แอดมินตรวจร้าน (api-spec 3.1–3.8, D-18)
// เจ้าของ: QA
const { ok, created, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const pagination = require('../utils/pagination');
const sellerService = require('../services/seller.service');

// 3.1 POST /api/seller/profile
const openShop = asyncHandler(async (req, res) => {
  created(res, await sellerService.openShop(req.user.id, req.body));
});

// 3.2 GET /api/seller/profile → SellerProfile | null
const getMyProfile = asyncHandler(async (req, res) => {
  ok(res, await sellerService.getMyProfile(req.user.id));
});

// 3.3 PUT /api/seller/profile
const updateMyProfile = asyncHandler(async (req, res) => {
  ok(res, await sellerService.updateMyProfile(req.user.id, req.body));
});

// 3.4 GET /api/sellers/:userId
const getPublicProfile = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId, 'userId');
  ok(res, await sellerService.getPublicProfile(userId));
});

// 3.5 GET /api/admin/seller-applications
const listApplications = asyncHandler(async (req, res) => {
  ok(res, await sellerService.listApplications({ ...req.query, ...pagination(req.query) }));
});

// 3.6 GET /api/admin/seller-applications/:userId
const getApplication = asyncHandler(async (req, res) => {
  ok(res, await sellerService.getApplication(parseId(req.params.userId, 'userId')));
});

// 3.7 POST /api/admin/seller-applications/:userId/approve
const approveApplication = asyncHandler(async (req, res) => {
  ok(res, await sellerService.approveApplication(parseId(req.params.userId, 'userId'), req.user.id, req.ip));
});

// 3.8 POST /api/admin/seller-applications/:userId/reject
const rejectApplication = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId, 'userId');
  ok(res, await sellerService.rejectApplication(userId, req.user.id, req.ip, req.body && req.body.reason));
});

module.exports = {
  openShop,
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
};
