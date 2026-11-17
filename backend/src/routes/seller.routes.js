// seller.routes.js — เปิดสิทธิ์ผู้ขาย + สินค้าของฉัน (api-spec 3.1–3.4, 4.9)
// เจ้าของ: QA
const express = require('express');
const { requireAuth, requireRole, requireActiveAccount } = require('../middlewares/auth');
const sellerCtrl = require('../controllers/seller.controller');
const listingCtrl = require('../controllers/listing.controller');

const router = express.Router();

// ── เปิดสิทธิ์ผู้ขาย ──────────────────────────────────────────
// 3.1 POST  /api/seller/profile  — เปิดร้าน (member + sell)
router.post(
  '/profile',
  requireAuth,
  requireRole('member'),
  requireActiveAccount('sell'),
  sellerCtrl.openShop
);

// 3.2 GET   /api/seller/profile  — ข้อมูลร้านของฉัน
router.get('/profile', requireAuth, requireRole('seller'), sellerCtrl.getMyProfile);

// 3.3 PUT   /api/seller/profile  — แก้ข้อมูลร้าน
router.put(
  '/profile',
  requireAuth,
  requireRole('seller'),
  requireActiveAccount('sell'),
  sellerCtrl.updateMyProfile
);

// ── สินค้าของฉัน ──────────────────────────────────────────────
// 4.9 GET   /api/seller/listings
router.get('/listings', requireAuth, requireRole('seller'), listingCtrl.getMyListings);

module.exports = router;
