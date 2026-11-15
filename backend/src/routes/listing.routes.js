// listing.routes.js — สินค้า: ลงขายและอนุมัติ ฝั่ง seller (api-spec 4.1–4.8)
// เจ้าของ: QA
const express = require('express');
const { requireAuth, requireRole, requireActiveAccount } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const listingCtrl = require('../controllers/listing.controller');

const router = express.Router();

// 4.1 GET  /api/categories — public
// (mount ที่ /api/categories ใน index.js ไม่ใช่ /api/listings/categories)

// 4.2 POST /api/listings — สร้างสินค้า draft
router.post(
  '/',
  requireAuth,
  requireRole('seller'),
  requireActiveAccount('sell'),
  listingCtrl.createListing
);

// 4.3 PUT  /api/listings/:id — แก้ (เฉพาะ draft/pending_review/rejected)
router.put(
  '/:id',
  requireAuth,
  requireRole('seller'),
  requireActiveAccount('sell'),
  listingCtrl.updateListing
);

// 4.4 POST /api/listings/:id/images — อัปโหลดรูป (สูงสุด 8 ไฟล์)
router.post(
  '/:id/images',
  requireAuth,
  requireRole('seller'),
  requireActiveAccount('sell'),
  upload('products').array('images', 8),
  listingCtrl.uploadImages
);

// 4.5 DELETE /api/listings/:id/images/:imageId — ลบรูป
router.delete(
  '/:id/images/:imageId',
  requireAuth,
  requireRole('seller'),
  listingCtrl.deleteImage
);

// 4.6 POST /api/listings/:id/images/:imageId/cover — ตั้งรูปปก
router.post(
  '/:id/images/:imageId/cover',
  requireAuth,
  requireRole('seller'),
  listingCtrl.setCover
);

// 4.7 POST /api/listings/:id/submit — ส่งตรวจ
router.post(
  '/:id/submit',
  requireAuth,
  requireRole('seller'),
  requireActiveAccount('sell'),
  listingCtrl.submitListing
);

// 4.8 POST /api/listings/:id/cancel — ยกเลิก
router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('seller'),
  listingCtrl.cancelListing
);

module.exports = router;
