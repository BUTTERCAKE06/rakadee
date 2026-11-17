// Auction controller (เจ้าของ: Programmer) — api-spec 6.1–6.7
const { ok, created, asyncHandler } = require('../utils/response');
const AppError = require('../utils/AppError');
const parseId = require('../utils/parseId');
const auction = require('../services/auction.service');
const catalog = require('../services/catalog.service');

// จำนวนเงินจาก body -> สตางค์ (ตัวเลข > 0 ทศนิยมไม่เกิน 2 ตำแหน่ง) ไม่ผ่าน float
function readAmount(raw, field, label) {
  const isNum = typeof raw === 'number';
  const badNumber = isNum && (!Number.isFinite(raw) || Math.round(raw * 100) / 100 !== raw);
  const satang = badNumber ? NaN : auction.toSatang(isNum ? raw.toFixed(2) : raw);
  if (satang === null || Number.isNaN(satang) || satang <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label}ต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง`, {
      [field]: `${label}ต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง`,
    });
  }
  return satang;
}

const meta = (req) => ({ ip: req.ip || null, userAgent: req.get('user-agent') || null });

// 6.1 POST /api/listings/:id/bids { amount }
const placeBid = asyncHandler(async (req, res) => {
  const listingId = parseId(req.params.id, 'id');
  const amount = readAmount(req.body && req.body.amount, 'amount', 'ราคาที่เสนอ');
  created(res, await auction.placeBid({ listingId, user: req.user, amount, mode: 'manual', ...meta(req) }));
});

// 6.2 GET /api/listings/:id/proxy
const getProxy = asyncHandler(async (req, res) => {
  const listingId = parseId(req.params.id, 'id');
  ok(res, await auction.getMyProxy(listingId, req.user.id));
});

// 6.3 PUT /api/listings/:id/proxy { maxAmount }
const putProxy = asyncHandler(async (req, res) => {
  const listingId = parseId(req.params.id, 'id');
  const amount = readAmount(req.body && req.body.maxAmount, 'maxAmount', 'วงเงิน Proxy ');
  ok(res, await auction.placeBid({ listingId, user: req.user, amount, mode: 'proxy', ...meta(req) }));
});

// 6.5 POST /api/listings/:id/buy-now { confirm: true }
const buyNow = asyncHandler(async (req, res) => {
  const listingId = parseId(req.params.id, 'id');
  if (!req.body || req.body.confirm !== true) {
    throw new AppError(400, 'CONFIRM_REQUIRED', 'กรุณายืนยันการซื้อทันที');
  }
  created(res, await auction.buyNow({ listingId, user: req.user, ...meta(req) }));
});

// 6.6 GET /api/me/bids?status=active|ended
const myBids = asyncHandler(async (req, res) => {
  ok(res, await catalog.myBids(req.user.id, req.query.status));
});

// 6.7 GET /api/me/won
const myWon = asyncHandler(async (req, res) => {
  ok(res, await catalog.myWon(req.user.id));
});

module.exports = { placeBid, getProxy, putProxy, buyNow, myBids, myWon };
