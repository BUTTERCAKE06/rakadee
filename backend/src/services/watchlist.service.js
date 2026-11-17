// Watchlist service (เจ้าของ: Programmer) — api-spec 5.5–5.7, ข้อ 1.5-3
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { toCard, CARD_COLUMNS } = require('./catalog.service');

// 5.5 GET /api/watchlist
async function list(userId) {
  const [rows] = await db.query(
    `SELECT ${CARD_COLUMNS}, w.created_at AS added_at
       FROM watchlists w JOIN listings l ON l.id = w.listing_id
      WHERE w.user_id = ? AND l.status IN ('active', 'ended')
      ORDER BY w.created_at DESC, w.id DESC`,
    [userId],
  );
  return { items: rows.map((r) => ({ ...toCard(r), addedAt: new Date(r.added_at).toISOString() })) };
}

// 5.6 POST /api/watchlist { listingId }
async function add(userId, listingId) {
  const [[l]] = await db.query('SELECT status FROM listings WHERE id = ?', [listingId]);
  if (!l || !['active', 'ended'].includes(l.status)) throw new AppError(404, 'NOT_FOUND', 'ไม่พบสินค้านี้');
  try {
    await db.query('INSERT INTO watchlists (user_id, listing_id) VALUES (?, ?)', [userId, listingId]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, 'ALREADY_IN_WATCHLIST', 'สินค้านี้อยู่ใน Watchlist แล้ว');
    throw err;
  }
  return { listingId, inWatchlist: true };
}

// 5.7 DELETE /api/watchlist/:listingId (ลบซ้ำได้ ไม่ error)
async function remove(userId, listingId) {
  await db.query('DELETE FROM watchlists WHERE user_id = ? AND listing_id = ?', [userId, listingId]);
  return { listingId, inWatchlist: false };
}

module.exports = { list, add, remove };
