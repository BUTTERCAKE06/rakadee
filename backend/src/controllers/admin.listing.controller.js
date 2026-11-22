// admin.listing.controller.js — admin: อนุมัติ/ปฏิเสธสินค้า (api-spec 4.10–4.13)
// เจ้าของ: QA
const { ok, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const adminListingService = require('../services/admin.listing.service');

// 4.10 GET /api/admin/listings
const listListings = asyncHandler(async (req, res) => {
  const data = await adminListingService.adminListListings(req.query);
  ok(res, data);
});

// 4.11 GET /api/admin/listings/:id
const getListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await adminListingService.adminGetListing(id, req.user.id);
  ok(res, data);
});

// 4.12 POST /api/admin/listings/:id/approve
const approveListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await adminListingService.approveListing(id, req.user.id, req.ip);
  ok(res, data);
});

// 4.13 POST /api/admin/listings/:id/reject
const rejectListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await adminListingService.rejectListing(id, req.user.id, req.ip, req.body.reason);
  ok(res, data);
});

module.exports = { listListings, getListing, approveListing, rejectListing };
