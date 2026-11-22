// listing.service.js — สินค้า: ลงขายและอนุมัติ ฝั่ง seller (api-spec 4.1–4.9)
// เจ้าของ: QA
const db = require('../config/db');
const time = require('../config/time');
const AppError = require('../utils/AppError');

// ----------------------------------------------------------------
// constants
// ----------------------------------------------------------------
const EDITABLE_STATUSES = ['draft', 'pending_review', 'rejected'];
const ITEM_CONDITIONS = ['new', 'used_good', 'defective'];
const DURATION_DAYS_ALLOWED = [1, 3, 7];

// ----------------------------------------------------------------
// serializer — ListingDetail (เจ้าของ: Programmer ที่ 5.2)
// QA เขียนเองสำหรับ endpoint ของฝั่งเจ้าของ ห้ามแก้ไฟล์ Programmer
// ----------------------------------------------------------------
// ข้อมูล "me" ของผู้ดู ตาม ListingDetail ใน api-spec 5.2 — { isOwner, isLeading, inWatchlist, proxy }
async function buildMe(row, viewerId) {
  if (!viewerId) return null;
  const [[w]] = await db.query('SELECT 1 AS x FROM watchlists WHERE user_id = ? AND listing_id = ? LIMIT 1', [viewerId, row.id]);
  const [[p]] = await db.query('SELECT max_amount, is_active FROM proxy_bids WHERE listing_id = ? AND bidder_id = ?', [row.id, viewerId]);
  return {
    isOwner: Number(row.seller_id) === Number(viewerId),
    isLeading: row.current_bidder_id !== null && Number(row.current_bidder_id) === Number(viewerId),
    inWatchlist: Boolean(w),
    proxy: p ? { maxAmount: Number(p.max_amount), isActive: Boolean(p.is_active) } : null,
  };
}

function serializeListingDetail(row, images, isOwner = false, me = null) {
  const detail = {
    id: row.id,
    title: row.title,
    description: row.description,
    includedItems: row.included_items,
    itemCondition: row.item_condition,
    defectDetail: row.defect_detail,
    category: row.category_id ? {
      id: row.category_id,
      name: row.cat_name,
      parent: row.parent_id ? { id: row.parent_id, name: row.parent_name } : null,
    } : null,
    images: (images || []).map((img) => ({
      id: img.id,
      url: `/uploads/products/${img.file_path}`,
      isCover: !!img.is_cover,
      sortOrder: img.sort_order,
    })),
    shippingFee: Number(row.shipping_fee),
    originProvince: row.origin_province,
    startPrice: Number(row.start_price),
    bidIncrement: Number(row.bid_increment),
    currentPrice: row.current_price !== null ? Number(row.current_price) : null,
    minNextBid: row.current_price !== null
      ? Number(row.current_price) + Number(row.bid_increment)
      : Number(row.start_price),
    buyNowPrice: row.buy_now_price !== null ? Number(row.buy_now_price) : null,
    // buyNowAvailable: active + มี buyNowPrice + (ยังไม่มีบิด || currentPrice < buyNowPrice)
    buyNowAvailable: !!(
      row.buy_now_price &&
      row.status === 'active' &&
      (row.current_price === null || Number(row.current_price) < Number(row.buy_now_price))
    ),
    bidCount: row.bid_count,
    status: row.status,
    result: row.result,
    startAt: row.start_at ? row.start_at.toISOString() : null,
    endAt: row.end_at ? row.end_at.toISOString() : null,
    extendCount: row.extend_count,
    maxExtendCount: time.autoExtendMaxCount,
    serverTime: new Date().toISOString(),
    seller: {
      id: row.seller_id,
      displayName: row.seller_display_name,
      shopName: row.shop_name,
    },
    durationDays: row.duration_days,
    me,
  };

  // ฟิลด์เฉพาะเจ้าของ (seller + admin)
  if (isOwner) {
    detail.reservePrice = row.reserve_price !== null ? Number(row.reserve_price) : null;
    detail.rejectReason = row.reject_reason;
    detail.submittedAt = row.submitted_at ? row.submitted_at.toISOString() : null;
    detail.reserveMet = row.reserve_price !== null
      ? (row.current_price !== null && Number(row.current_price) >= Number(row.reserve_price))
      : null;
  }

  return detail;
}

// ดึงข้อมูล listing พร้อม images, category, seller
async function fetchListingRow(listingId) {
  const [[row]] = await db.query(
    `SELECT l.*,
            c.name AS cat_name, c.parent_id,
            cp.name AS parent_name,
            u.display_name AS seller_display_name,
            sp.shop_name
     FROM listings l
     LEFT JOIN categories c ON c.id = l.category_id
     LEFT JOIN categories cp ON cp.id = c.parent_id
     LEFT JOIN users u ON u.id = l.seller_id
     LEFT JOIN seller_profiles sp ON sp.user_id = l.seller_id
     WHERE l.id = ?`,
    [listingId]
  );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'ไม่พบสินค้า');
  return row;
}

async function fetchImages(listingId) {
  const [images] = await db.query(
    `SELECT id, file_path, is_cover, sort_order
     FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC`,
    [listingId]
  );
  return images;
}

// ----------------------------------------------------------------
// validation ข้อ 3.3
// ----------------------------------------------------------------
function validateListingBody(body) {
  const errors = {};
  const {
    title, categoryId, description, itemCondition, defectDetail,
    shippingFee, originProvince, startPrice, bidIncrement,
    reservePrice, buyNowPrice, durationDays,
  } = body;

  if (!title || !String(title).trim()) errors.title = 'ชื่อสินค้าต้องไม่ว่างเปล่า';
  if (!categoryId) errors.categoryId = 'กรุณาเลือกหมวดหมู่';
  if (!description || !String(description).trim()) errors.description = 'รายละเอียดสินค้าต้องไม่ว่างเปล่า';
  if (!itemCondition || !ITEM_CONDITIONS.includes(itemCondition)) {
    errors.itemCondition = `สภาพสินค้าต้องเป็นหนึ่งใน: ${ITEM_CONDITIONS.join(', ')}`;
  }
  // บังคับสำหรับสินค้ามือสองทุกแบบ (ข้อ 3.1-1f + ภาพ UI ลงสินค้าขั้น 1) — ถ้าไม่มีตำหนิให้พิมพ์ "ไม่มีตำหนิ"
  if ((itemCondition === 'used_good' || itemCondition === 'defective') && !String(defectDetail ?? '').trim()) {
    errors.defectDetail = 'กรุณาระบุตำหนิ หรือพิมพ์ "ไม่มีตำหนิ"';
  }
  if (!originProvince || !String(originProvince).trim()) errors.originProvince = 'จังหวัดต้นทางต้องไม่ว่างเปล่า';

  // ตัวเลข
  const sp = Number(startPrice);
  const bi = Number(bidIncrement);
  const sf = Number(shippingFee);

  if (startPrice === undefined || startPrice === null || startPrice === '') {
    errors.startPrice = 'ราคาเริ่มต้นต้องไม่ว่างเปล่า';
  } else if (isNaN(sp) || sp <= 0) {
    errors.startPrice = 'ราคาเริ่มต้นต้องมากกว่า 0';
  }
  if (bidIncrement === undefined || bidIncrement === null || bidIncrement === '') {
    errors.bidIncrement = 'ขั้นต่ำการเพิ่มราคาต้องไม่ว่างเปล่า';
  } else if (isNaN(bi) || bi <= 0) {
    errors.bidIncrement = 'ขั้นต่ำการเพิ่มราคาต้องมากกว่า 0';
  }
  if (shippingFee === undefined || shippingFee === null || shippingFee === '') {
    errors.shippingFee = 'ค่าจัดส่งต้องไม่ว่างเปล่า';
  } else if (isNaN(sf) || sf < 0) {
    errors.shippingFee = 'ค่าจัดส่งต้องไม่ติดลบ';
  }

  if (reservePrice !== undefined && reservePrice !== null && reservePrice !== '') {
    const rp = Number(reservePrice);
    if (isNaN(rp) || rp < 0) {
      errors.reservePrice = 'ราคาขั้นต่ำที่ยอมขายต้องไม่ติดลบ';
    } else if (!isNaN(sp) && rp < sp) {
      errors.reservePrice = 'ราคาขั้นต่ำที่ยอมขายต้องไม่น้อยกว่าราคาเริ่มต้น';
    }
  }

  if (buyNowPrice !== undefined && buyNowPrice !== null && buyNowPrice !== '') {
    const bn = Number(buyNowPrice);
    if (isNaN(bn) || bn < 0) {
      errors.buyNowPrice = 'ราคาซื้อทันทีต้องไม่ติดลบ';
    } else if (!isNaN(sp) && bn <= sp) {
      errors.buyNowPrice = 'ราคาซื้อทันทีต้องมากกว่าราคาเริ่มต้น';
    } else if (reservePrice !== undefined && reservePrice !== null && reservePrice !== '') {
      const rp = Number(reservePrice);
      if (!isNaN(rp) && bn <= rp) {
        errors.buyNowPrice = 'ราคาซื้อทันทีต้องมากกว่าราคาขั้นต่ำที่ยอมขาย';
      }
    }
  }

  if (!durationDays || !DURATION_DAYS_ALLOWED.includes(Number(durationDays))) {
    errors.durationDays = 'ระยะเวลาประมูลต้องเป็น 1, 3 หรือ 7 วัน';
  }

  return errors;
}

// ----------------------------------------------------------------
// 4.1 GET /api/categories
// ----------------------------------------------------------------
async function getCategories() {
  const [rows] = await db.query(
    `SELECT id, parent_id, name, slug FROM categories ORDER BY sort_order ASC, id ASC`
  );
  const parents = rows.filter((r) => !r.parent_id);
  const children = rows.filter((r) => !!r.parent_id);

  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    children: children
      .filter((c) => c.parent_id === p.id)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  }));
}

// ----------------------------------------------------------------
// 4.2 POST /api/listings — สร้างสินค้า (draft)
// ----------------------------------------------------------------
async function createListing(sellerId, body) {
  // ตรวจว่า categoryId เป็นหมวดย่อย
  await assertSubCategory(body.categoryId);

  // validate (ยกเว้น durationDays ที่บังคับตรวจ)
  const errors = validateListingBody(body);
  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', errors);
  }

  // ค่าเริ่มต้น originProvince จากร้านถ้าไม่ส่งมา
  let originProv = body.originProvince;
  if (!originProv) {
    const [[sp]] = await db.query('SELECT origin_province FROM seller_profiles WHERE user_id = ?', [sellerId]);
    originProv = sp?.origin_province;
  }

  const [result] = await db.query(
    `INSERT INTO listings
       (seller_id, category_id, title, description, included_items,
        item_condition, defect_detail,
        shipping_fee, origin_province,
        start_price, bid_increment, reserve_price, buy_now_price,
        duration_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [
      sellerId,
      body.categoryId,
      String(body.title).trim(),
      String(body.description).trim(),
      body.includedItems ? String(body.includedItems).trim() : null,
      body.itemCondition,
      body.itemCondition !== 'new' && body.defectDetail ? String(body.defectDetail).trim() || null : null,
      Number(body.shippingFee),
      originProv,
      Number(body.startPrice),
      Number(body.bidIncrement),
      body.reservePrice !== undefined && body.reservePrice !== null && body.reservePrice !== ''
        ? Number(body.reservePrice) : null,
      body.buyNowPrice !== undefined && body.buyNowPrice !== null && body.buyNowPrice !== ''
        ? Number(body.buyNowPrice) : null,
      Number(body.durationDays),
    ]
  );

  const listingId = result.insertId;
  const row = await fetchListingRow(listingId);
  const images = await fetchImages(listingId);
  return serializeListingDetail(row, images, true, await buildMe(row, sellerId));
}

// ----------------------------------------------------------------
// 4.3 PUT /api/listings/:id — แก้ (เฉพาะ draft/pending_review/rejected)
// ----------------------------------------------------------------
async function updateListing(listingId, sellerId, body) {
  const row = await fetchListingRow(listingId);

  if (row.seller_id !== sellerId) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขสินค้านี้');
  }
  if (!EDITABLE_STATUSES.includes(row.status)) {
    throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถแก้ไขสินค้าในสถานะนี้', { status: row.status });
  }

  if (body.categoryId) await assertSubCategory(body.categoryId);

  const errors = validateListingBody({ ...row, ...body });
  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', errors);
  }

  await db.query(
    `UPDATE listings SET
       category_id    = ?,
       title          = ?,
       description    = ?,
       included_items = ?,
       item_condition = ?,
       defect_detail  = ?,
       shipping_fee   = ?,
       origin_province= ?,
       start_price    = ?,
       bid_increment  = ?,
       reserve_price  = ?,
       buy_now_price  = ?,
       duration_days  = ?
     WHERE id = ?`,
    [
      body.categoryId   ?? row.category_id,
      body.title        ? String(body.title).trim()       : row.title,
      body.description  ? String(body.description).trim() : row.description,
      body.includedItems !== undefined
        ? (body.includedItems ? String(body.includedItems).trim() : null)
        : row.included_items,
      body.itemCondition ?? row.item_condition,
      // เก็บรายละเอียดตำหนิสำหรับสินค้ามือสองทุกแบบ (บังคับเฉพาะ defective ตาม validate) ของใหม่ไม่เก็บ
      (body.itemCondition ?? row.item_condition) !== 'new'
        ? (body.defectDetail !== undefined ? (String(body.defectDetail ?? '').trim() || null) : row.defect_detail)
        : null,
      body.shippingFee !== undefined ? Number(body.shippingFee) : row.shipping_fee,
      body.originProvince ? String(body.originProvince).trim() : row.origin_province,
      body.startPrice   !== undefined ? Number(body.startPrice)  : row.start_price,
      body.bidIncrement !== undefined ? Number(body.bidIncrement) : row.bid_increment,
      body.reservePrice !== undefined
        ? (body.reservePrice !== null && body.reservePrice !== '' ? Number(body.reservePrice) : null)
        : row.reserve_price,
      body.buyNowPrice !== undefined
        ? (body.buyNowPrice !== null && body.buyNowPrice !== '' ? Number(body.buyNowPrice) : null)
        : row.buy_now_price,
      body.durationDays !== undefined ? Number(body.durationDays) : row.duration_days,
      listingId,
    ]
  );

  const updated = await fetchListingRow(listingId);
  const images = await fetchImages(listingId);
  return serializeListingDetail(updated, images, true, await buildMe(updated, sellerId));
}

// ----------------------------------------------------------------
// 4.4 POST /api/listings/:id/images — อัปโหลดรูป
// ----------------------------------------------------------------
async function addImages(listingId, sellerId, files) {
  const row = await fetchListingRow(listingId);
  if (row.seller_id !== sellerId) throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์');
  if (!EDITABLE_STATUSES.includes(row.status)) {
    throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถเพิ่มรูปในสถานะนี้', { status: row.status });
  }

  const [existingImgs] = await db.query(
    'SELECT COUNT(*) AS cnt FROM listing_images WHERE listing_id = ?', [listingId]
  );
  const existCount = existingImgs[0].cnt;
  if (existCount + files.length > 8) {
    throw new AppError(400, 'TOO_MANY_IMAGES', `จำนวนรูปสูงสุดคือ 8 รูป (มีอยู่แล้ว ${existCount} รูป)`);
  }

  const isFirstEver = existCount === 0;
  for (let i = 0; i < files.length; i++) {
    const isCover = isFirstEver && i === 0 ? 1 : 0;
    const sortOrder = existCount + i;
    // เก็บ path แบบ filename เท่านั้น (ไม่มี folder prefix)
    const filePath = files[i].filename;
    await db.query(
      `INSERT INTO listing_images (listing_id, file_path, is_cover, sort_order)
       VALUES (?, ?, ?, ?)`,
      [listingId, filePath, isCover, sortOrder]
    );
  }

  const images = await fetchImages(listingId);
  return { images: images.map((img) => ({
    id: img.id,
    url: `/uploads/products/${img.file_path}`,
    isCover: !!img.is_cover,
    sortOrder: img.sort_order,
  })) };
}

// ----------------------------------------------------------------
// 4.5 DELETE /api/listings/:id/images/:imageId — ลบรูป
// ----------------------------------------------------------------
async function deleteImage(listingId, sellerId, imageId) {
  const row = await fetchListingRow(listingId);
  if (row.seller_id !== sellerId) throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์');
  if (!EDITABLE_STATUSES.includes(row.status)) {
    throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถลบรูปในสถานะนี้', { status: row.status });
  }

  const [[img]] = await db.query(
    'SELECT id, is_cover FROM listing_images WHERE id = ? AND listing_id = ?',
    [imageId, listingId]
  );
  if (!img) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรูปภาพ');

  await db.query('DELETE FROM listing_images WHERE id = ?', [imageId]);

  // ถ้าลบรูปปกออก ตั้งรูปแรกที่เหลือเป็นปกแทน
  if (img.is_cover) {
    await db.query(
      `UPDATE listing_images SET is_cover = 1
       WHERE listing_id = ? ORDER BY sort_order ASC LIMIT 1`,
      [listingId]
    );
  }

  const images = await fetchImages(listingId);
  return { images: images.map((i) => ({
    id: i.id,
    url: `/uploads/products/${i.file_path}`,
    isCover: !!i.is_cover,
    sortOrder: i.sort_order,
  })) };
}

// ----------------------------------------------------------------
// 4.6 POST /api/listings/:id/images/:imageId/cover — ตั้งเป็นรูปปก
// ----------------------------------------------------------------
async function setCover(listingId, sellerId, imageId) {
  const row = await fetchListingRow(listingId);
  if (row.seller_id !== sellerId) throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์');
  if (!EDITABLE_STATUSES.includes(row.status)) {
    throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถเปลี่ยนรูปปกในสถานะนี้', { status: row.status });
  }

  const [[img]] = await db.query(
    'SELECT id FROM listing_images WHERE id = ? AND listing_id = ?',
    [imageId, listingId]
  );
  if (!img) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรูปภาพ');

  await db.withTransaction(async (conn) => {
    await conn.execute(
      'UPDATE listing_images SET is_cover = 0 WHERE listing_id = ?',
      [listingId]
    );
    await conn.execute(
      'UPDATE listing_images SET is_cover = 1 WHERE id = ?',
      [imageId]
    );
  });

  const images = await fetchImages(listingId);
  return { images: images.map((i) => ({
    id: i.id,
    url: `/uploads/products/${i.file_path}`,
    isCover: !!i.is_cover,
    sortOrder: i.sort_order,
  })) };
}

// ----------------------------------------------------------------
// 4.7 POST /api/listings/:id/submit — ส่งตรวจ
// ----------------------------------------------------------------
async function submitListing(listingId, sellerId) {
  const row = await fetchListingRow(listingId);
  if (row.seller_id !== sellerId) throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์');
  if (!['draft', 'rejected'].includes(row.status)) {
    throw new AppError(409, 'INVALID_STATE', 'สินค้านี้ไม่สามารถส่งตรวจได้', { status: row.status });
  }

  // ตรวจว่ามีรูปและมีปก
  const images = await fetchImages(listingId);
  if (images.length === 0) {
    throw new AppError(400, 'IMAGES_REQUIRED', 'กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป');
  }
  if (!images.some((img) => img.is_cover)) {
    throw new AppError(400, 'IMAGES_REQUIRED', 'กรุณาตั้งรูปปกสินค้า');
  }

  // ตรวจ validation ซ้ำ
  const errors = validateListingBody({
    title: row.title, categoryId: row.category_id, description: row.description,
    itemCondition: row.item_condition, defectDetail: row.defect_detail,
    shippingFee: row.shipping_fee, originProvince: row.origin_province,
    startPrice: row.start_price, bidIncrement: row.bid_increment,
    reservePrice: row.reserve_price, buyNowPrice: row.buy_now_price,
    durationDays: row.duration_days,
  });
  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลสินค้าไม่ครบถ้วน กรุณาแก้ไขก่อนส่ง', errors);
  }

  const submittedAt = new Date();
  await db.query(
    `UPDATE listings SET status = 'pending_review', submitted_at = ?, reject_reason = NULL WHERE id = ?`,
    [submittedAt, listingId]
  );

  return { id: listingId, status: 'pending_review', submittedAt: submittedAt.toISOString() };
}

// ----------------------------------------------------------------
// 4.8 POST /api/listings/:id/cancel — ยกเลิก
// ----------------------------------------------------------------
async function cancelListing(listingId, sellerId) {
  const row = await fetchListingRow(listingId);
  if (row.seller_id !== sellerId) throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์');
  if (row.status === 'active' || row.status === 'ended') {
    throw new AppError(409, 'INVALID_STATE', 'ไม่สามารถยกเลิกสินค้าที่เริ่มประมูลแล้ว', { status: row.status });
  }
  if (row.status === 'cancelled') {
    throw new AppError(409, 'INVALID_STATE', 'สินค้านี้ถูกยกเลิกไปแล้ว', { status: row.status });
  }

  await db.query(
    `UPDATE listings SET status = 'cancelled' WHERE id = ?`,
    [listingId]
  );

  return { id: listingId, status: 'cancelled' };
}

// ----------------------------------------------------------------
// 4.9 GET /api/seller/listings — สินค้าของฉัน
// ----------------------------------------------------------------
async function getMyListings(sellerId, { status, page = 1, limit = 20 }) {
  const pg = Math.max(1, Number(page));
  const lm = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pg - 1) * lm;

  const where = ['l.seller_id = ?'];
  const params = [sellerId];
  if (status) {
    where.push('l.status = ?');
    params.push(status);
  }

  const whereClause = where.join(' AND ');

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM listings l WHERE ${whereClause}`,
    params
  );

  const [rows] = await db.query(
    `SELECT l.id, l.title,
            (SELECT CONCAT('/uploads/products/', li.file_path)
             FROM listing_images li
             WHERE li.listing_id = l.id AND li.is_cover = 1
             LIMIT 1) AS cover_url,
            l.item_condition, l.current_price, l.start_price,
            l.bid_count, l.buy_now_price, l.shipping_fee,
            l.status, l.end_at, l.category_id,
            l.reject_reason, l.submitted_at, l.duration_days
     FROM listings l
     WHERE ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lm, offset]
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      coverUrl: r.cover_url || null,
      itemCondition: r.item_condition,
      currentPrice: r.current_price !== null ? Number(r.current_price) : null,
      startPrice: Number(r.start_price),
      bidCount: r.bid_count,
      buyNowPrice: r.buy_now_price !== null ? Number(r.buy_now_price) : null,
      shippingFee: Number(r.shipping_fee),
      status: r.status,
      endAt: r.end_at ? r.end_at.toISOString() : null,
      categoryId: r.category_id,
      rejectReason: r.reject_reason,
      submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
      durationDays: r.duration_days, // เพิ่มจาก spec 4.9 สำหรับคอลัมน์ "ระยะเวลา" ในหน้าสินค้าของฉัน (รอ SA เพิ่มใน api-spec)
    })),
    page: pg,
    limit: lm,
    total,
  };
}

// ----------------------------------------------------------------
// internal helper: ตรวจว่า categoryId เป็นหมวดย่อย (parent_id IS NOT NULL)
// ----------------------------------------------------------------
async function assertSubCategory(categoryId) {
  const [[cat]] = await db.query(
    'SELECT id, parent_id FROM categories WHERE id = ?',
    [categoryId]
  );
  if (!cat) throw new AppError(400, 'VALIDATION_ERROR', 'ไม่พบหมวดหมู่ที่ระบุ', { categoryId: 'ไม่พบหมวดหมู่' });
  if (!cat.parent_id) throw new AppError(400, 'VALIDATION_ERROR', 'กรุณาเลือกหมวดหมู่ย่อย', { categoryId: 'ต้องเลือกหมวดหมู่ย่อย ไม่ใช่หมวดหลัก' });
}

module.exports = {
  getCategories,
  createListing,
  updateListing,
  addImages,
  deleteImage,
  setCover,
  submitListing,
  cancelListing,
  getMyListings,
  fetchListingRow,
  fetchImages,
  serializeListingDetail,
  buildMe,
};
