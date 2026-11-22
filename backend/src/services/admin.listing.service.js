// admin.listing.service.js — admin: อนุมัติ/ปฏิเสธสินค้า (api-spec 4.10–4.13)
// เจ้าของ: QA
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { notify, EVENTS } = require('./notify');
const audit = require('./audit');
const { fetchListingRow, fetchImages, serializeListingDetail, buildMe } = require('./listing.service');

// ----------------------------------------------------------------
// 4.10 GET /api/admin/listings — รายการตามสถานะ
// ----------------------------------------------------------------
async function adminListListings({ status = 'pending_review', q, page = 1, limit = 20 }) {
  const pg = Math.max(1, Number(page));
  const lm = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pg - 1) * lm;

  const where = ['1=1'];
  const params = [];

  if (status) { where.push('l.status = ?'); params.push(status); }
  if (q) {
    where.push('(l.title LIKE ? OR u.display_name LIKE ? OR u.username LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM listings l
     JOIN users u ON u.id = l.seller_id
     WHERE ${whereClause}`,
    params
  );

  const [rows] = await db.query(
    `SELECT l.id, l.title, l.status, l.start_price, l.submitted_at, l.end_at,
            (SELECT CONCAT('/uploads/products/', li.file_path)
             FROM listing_images li
             WHERE li.listing_id = l.id AND li.is_cover = 1
             LIMIT 1) AS cover_url,
            u.id AS seller_id, u.display_name, u.username,
            sp.shop_name,
            c.name AS category_name
     FROM listings l
     JOIN users u ON u.id = l.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id = l.seller_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE ${whereClause}
     ORDER BY l.submitted_at ASC, l.created_at ASC
     LIMIT ? OFFSET ?`,
    [...params, lm, offset]
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      coverUrl: r.cover_url || null,
      seller: {
        id: r.seller_id,
        displayName: r.display_name,
        shopName: r.shop_name,
      },
      categoryName: r.category_name,
      startPrice: Number(r.start_price),
      submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
      endAt: r.end_at ? r.end_at.toISOString() : null,
      status: r.status,
    })),
    page: pg,
    limit: lm,
    total,
  };
}

// ----------------------------------------------------------------
// 4.11 GET /api/admin/listings/:id — รายละเอียดเต็ม (รวม reserve)
// ----------------------------------------------------------------
async function adminGetListing(listingId, adminId) {
  const row = await fetchListingRow(listingId);
  const images = await fetchImages(listingId);
  return serializeListingDetail(row, images, true /* isOwner = show reservePrice */, await buildMe(row, adminId));
}

// ----------------------------------------------------------------
// 4.12 POST /api/admin/listings/:id/approve — อนุมัติ
// ----------------------------------------------------------------
async function approveListing(listingId, adminId, adminIp) {
  const row = await fetchListingRow(listingId);
  if (row.status !== 'pending_review') {
    throw new AppError(409, 'INVALID_STATE', 'สินค้านี้ไม่ได้อยู่ในสถานะรอตรวจสอบ', { status: row.status });
  }

  const now = new Date();
  const endAt = new Date(now.getTime() + row.duration_days * 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE listings
     SET status = 'active',
         start_at = ?,
         end_at = ?,
         current_price = NULL,
         reviewed_by = ?,
         reviewed_at = ?
     WHERE id = ?`,
    [now, endAt, adminId, now, listingId]
  );

  // แจ้งเตือนผู้ขาย
  await notify(row.seller_id, EVENTS.LISTING_APPROVED, { listingId });

  // audit log
  await audit.log(adminId, 'LISTING_APPROVE', 'listing', listingId, adminIp);

  return {
    id: listingId,
    status: 'active',
    startAt: now.toISOString(),
    endAt: endAt.toISOString(),
  };
}

// ----------------------------------------------------------------
// 4.13 POST /api/admin/listings/:id/reject — ปฏิเสธ
// ----------------------------------------------------------------
async function rejectListing(listingId, adminId, adminIp, reason) {
  if (!reason || !String(reason).trim() || String(reason).trim().length < 5) {
    throw new AppError(400, 'REASON_REQUIRED', 'กรุณาระบุเหตุผลการปฏิเสธ (5–500 ตัวอักษร)');
  }
  if (String(reason).trim().length > 500) {
    throw new AppError(400, 'REASON_REQUIRED', 'เหตุผลต้องไม่เกิน 500 ตัวอักษร');
  }

  const row = await fetchListingRow(listingId);
  if (row.status !== 'pending_review') {
    throw new AppError(409, 'INVALID_STATE', 'สินค้านี้ไม่ได้อยู่ในสถานะรอตรวจสอบ', { status: row.status });
  }

  const now = new Date();
  const trimmedReason = String(reason).trim();

  await db.query(
    `UPDATE listings
     SET status = 'rejected',
         reject_reason = ?,
         reviewed_by = ?,
         reviewed_at = ?
     WHERE id = ?`,
    [trimmedReason, adminId, now, listingId]
  );

  // แจ้งเตือนผู้ขาย
  await notify(row.seller_id, EVENTS.LISTING_REJECTED, { listingId, reason: trimmedReason });

  // audit log
  await audit.log(adminId, 'LISTING_REJECT', 'listing', listingId, adminIp);

  return { id: listingId, status: 'rejected', rejectReason: trimmedReason };
}

module.exports = {
  adminListListings,
  adminGetListing,
  approveListing,
  rejectListing,
};
