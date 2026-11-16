// seller.controller.js — เปิดสิทธิ์ผู้ขาย (api-spec 3.1–3.4)
// เจ้าของ: QA
const { ok, created, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const sellerService = require('../services/seller.service');

// 3.1 POST /api/seller/profile
const openShop = asyncHandler(async (req, res) => {
  const data = await sellerService.openShop(req.user.id, req.body);
  created(res, data);
});

// 3.2 GET /api/seller/profile
const getMyProfile = asyncHandler(async (req, res) => {
  const data = await sellerService.getMyProfile(req.user.id);
  ok(res, data);
});

// 3.3 PUT /api/seller/profile
const updateMyProfile = asyncHandler(async (req, res) => {
  const data = await sellerService.updateMyProfile(req.user.id, req.body);
  ok(res, data);
});

// 3.4 GET /api/sellers/:userId — param guard: userId ต้องเป็นเลขบวก
const getPublicProfile = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId, 'userId');
  const data = await sellerService.getPublicProfile(userId);
  ok(res, data);
});

module.exports = { openShop, getMyProfile, updateMyProfile, getPublicProfile };
