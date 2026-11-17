// Watchlist controller (เจ้าของ: Programmer) — api-spec 5.5–5.7
const { ok, created, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const watchlist = require('../services/watchlist.service');

// 5.5 GET /api/watchlist
const list = asyncHandler(async (req, res) => {
  ok(res, await watchlist.list(req.user.id));
});

// 5.6 POST /api/watchlist { listingId }
const add = asyncHandler(async (req, res) => {
  const listingId = parseId(req.body && req.body.listingId, 'listingId');
  created(res, await watchlist.add(req.user.id, listingId));
});

// 5.7 DELETE /api/watchlist/:listingId
const remove = asyncHandler(async (req, res) => {
  const listingId = parseId(req.params.listingId, 'listingId');
  ok(res, await watchlist.remove(req.user.id, listingId));
});

module.exports = { list, add, remove };
