// listing.controller.js — สินค้า: ลงขายและอนุมัติ ฝั่ง seller (api-spec 4.1–4.9)
// เจ้าของ: QA
const { ok, created, asyncHandler } = require('../utils/response');
const AppError = require('../utils/AppError');
const parseId = require('../utils/parseId');
const listingService = require('../services/listing.service');

// 4.1 GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const data = await listingService.getCategories();
  ok(res, { items: data });
});

// 4.2 POST /api/listings
const createListing = asyncHandler(async (req, res) => {
  const data = await listingService.createListing(req.user.id, req.body);
  created(res, data);
});

// 4.3 PUT /api/listings/:id
const updateListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await listingService.updateListing(id, req.user.id, req.body);
  ok(res, data);
});

// 4.4 POST /api/listings/:id/images
const uploadImages = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  if (!req.files || req.files.length === 0) {
    throw new AppError(400, 'IMAGES_REQUIRED', 'กรุณาเลือกไฟล์อย่างน้อย 1 รูป');
  }
  const data = await listingService.addImages(id, req.user.id, req.files);
  ok(res, data);
});

// 4.5 DELETE /api/listings/:id/images/:imageId
const deleteImage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const imageId = parseId(req.params.imageId, 'imageId');
  const data = await listingService.deleteImage(id, req.user.id, imageId);
  ok(res, data);
});

// 4.6 POST /api/listings/:id/images/:imageId/cover
const setCover = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const imageId = parseId(req.params.imageId, 'imageId');
  const data = await listingService.setCover(id, req.user.id, imageId);
  ok(res, data);
});

// 4.7 POST /api/listings/:id/submit
const submitListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await listingService.submitListing(id, req.user.id);
  ok(res, data);
});

// 4.8 POST /api/listings/:id/cancel
const cancelListing = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const data = await listingService.cancelListing(id, req.user.id);
  ok(res, data);
});

// 4.9 GET /api/seller/listings
const getMyListings = asyncHandler(async (req, res) => {
  const data = await listingService.getMyListings(req.user.id, req.query);
  ok(res, data);
});

module.exports = {
  getCategories,
  createListing,
  updateListing,
  uploadImages,
  deleteImage,
  setCover,
  submitListing,
  cancelListing,
  getMyListings,
};
