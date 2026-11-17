// Catalog controller (เจ้าของ: Programmer) — api-spec 5.1–5.4
// หน้าเหล่านี้เป็น public: Guest เรียกได้ ถ้าส่ง token มาจะรู้ว่าเป็นใคร (ใช้ตอบ me / isMe)
const { ok, asyncHandler } = require('../utils/response');
const pagination = require('../utils/pagination');
const parseId = require('../utils/parseId');
const { findUserByToken } = require('../middlewares/auth');
const catalog = require('../services/catalog.service');

// อ่านผู้ใช้แบบไม่บังคับ login (token ผิด/หมดอายุ = Guest)
async function optionalUser(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return findUserByToken(token);
}

// 5.1 GET /api/listings
const search = asyncHandler(async (req, res) => {
  ok(res, await catalog.search(req.query, pagination(req.query)));
});

// 5.2 GET /api/listings/:id
const detail = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  ok(res, await catalog.detail(id, await optionalUser(req)));
});

// 5.3 GET /api/listings/:id/bids
const bidHistory = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  ok(res, await catalog.bidHistory(id, await optionalUser(req), pagination(req.query)));
});

// 5.4 GET /api/home
const home = asyncHandler(async (req, res) => {
  ok(res, await catalog.home());
});

module.exports = { search, detail, bidHistory, home };
