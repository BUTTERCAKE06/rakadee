// Catalog service — หน้าแรก ค้นหา รายละเอียดสินค้า ประวัติบิด การประมูลของฉัน รายการที่ชนะ (เจ้าของ: Programmer)
// api-spec 5.1–5.4, 6.6, 6.7 · ข้อ 1.5-2, 3.5
// อ่านอย่างเดียว ไม่แตะเงิน จึงไม่ต้องใช้ transaction
const db = require('../config/db');
const time = require('../config/time');
const AppError = require('../utils/AppError');
const { maskUsername, toSatang, minNextBid, isBuyNowAvailable } = require('./auction.service');

const PUBLIC_STATUSES = ['active', 'ended'];
const CONDITIONS = ['new', 'used_good', 'defective'];
const SORTS = {
  newest: 'l.start_at DESC, l.id DESC',
  ending_soon: 'l.end_at ASC, l.id ASC',
  price_asc: 'COALESCE(l.current_price, l.start_price) ASC, l.id ASC',
  price_desc: 'COALESCE(l.current_price, l.start_price) DESC, l.id DESC',
};
const HOME_SIZE = 8; // api-spec 5.4

// คอลัมน์ของ ListingCard (api-spec 0.6) รูปปกใช้ path แบบเดียวกับ QA (/uploads/products/<file_path>)
const CARD_COLUMNS = `l.id, l.title, l.item_condition, l.current_price, l.start_price, l.bid_count,
  l.buy_now_price, l.shipping_fee, l.status, l.end_at, l.category_id,
  (SELECT CONCAT('/uploads/products/', li.file_path) FROM listing_images li
    WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) AS cover_url`;

const num = (v) => (v === null || v === undefined ? null : Number(v));
const isoOrNull = (d) => (d ? new Date(d).toISOString() : null);

function toCard(r) {
  return {
    id: r.id,
    title: r.title,
    coverUrl: r.cover_url || null,
    itemCondition: r.item_condition,
    currentPrice: num(r.current_price),
    startPrice: num(r.start_price),
    bidCount: r.bid_count,
    buyNowPrice: num(r.buy_now_price),
    shippingFee: num(r.shipping_fee),
    status: r.status,
    endAt: isoOrNull(r.end_at),
    categoryId: r.category_id,
  };
}

function validationError(details) {
  const first = Object.values(details)[0];
  return new AppError(400, 'VALIDATION_ERROR', first, details);
}

// ราคาจาก query: ตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง
function parsePrice(raw, field, label) {
  if (raw === undefined || raw === '') return null;
  const satang = toSatang(String(raw));
  if (Number.isNaN(satang)) throw validationError({ [field]: `${label}ต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง` });
  return satang;
}
const satangToDecimal = (s) => `${Math.floor(s / 100)}.${String(s % 100).padStart(2, '0')}`;

/**
 * 5.1 GET /api/listings — ค้นหา/กรอง/เรียง (เฉพาะ active และ ended)
 * @param {object} q query จาก req.query
 * @param {{page:number, limit:number}} paging
 */
async function search(q, { page, limit }) {
  const where = [];
  const params = [];

  const status = q.status || 'active';
  if (!PUBLIC_STATUSES.includes(status)) throw validationError({ status: 'สถานะต้องเป็น active หรือ ended' });
  where.push('l.status = ?');
  params.push(status);

  const text = typeof q.q === 'string' ? q.q.trim() : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(l.title LIKE ? OR l.description LIKE ?)');
    params.push(like, like);
  }

  if (q.categoryId !== undefined && q.categoryId !== '') {
    const id = Number(q.categoryId);
    if (!Number.isInteger(id) || id <= 0) throw validationError({ categoryId: 'หมวดหมู่ไม่ถูกต้อง' });
    where.push('(l.category_id = ? OR c.parent_id = ?)'); // หมวดหลักรวมหมวดย่อย
    params.push(id, id);
  }

  if (q.condition) {
    const list = String(q.condition).split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length || list.some((c) => !CONDITIONS.includes(c))) {
      throw validationError({ condition: 'สภาพสินค้าต้องเป็น new, used_good หรือ defective' });
    }
    where.push('l.item_condition IN (?)');
    params.push(list);
  }

  const min = parsePrice(q.minPrice, 'minPrice', 'ราคาต่ำสุด');
  const max = parsePrice(q.maxPrice, 'maxPrice', 'ราคาสูงสุด');
  if (min !== null && max !== null && min > max) throw validationError({ minPrice: 'ราคาต่ำสุดต้องไม่มากกว่าราคาสูงสุด' });
  if (min !== null) { where.push('COALESCE(l.current_price, l.start_price) >= ?'); params.push(satangToDecimal(min)); }
  if (max !== null) { where.push('COALESCE(l.current_price, l.start_price) <= ?'); params.push(satangToDecimal(max)); }

  if (q.endingWithinHours !== undefined && q.endingWithinHours !== '') {
    const hours = Number(q.endingWithinHours);
    if (!Number.isFinite(hours) || hours <= 0) throw validationError({ endingWithinHours: 'จำนวนชั่วโมงต้องมากกว่า 0' });
    where.push('l.end_at > UTC_TIMESTAMP() AND l.end_at <= ?');
    params.push(new Date(Date.now() + hours * 60 * 60 * 1000));
  }

  const sort = q.sort || 'newest';
  if (!SORTS[sort]) throw validationError({ sort: 'การเรียงต้องเป็น newest, ending_soon, price_asc หรือ price_desc' });

  const from = 'FROM listings l JOIN categories c ON c.id = l.category_id';
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${whereSql}`, params);
  const [rows] = await db.query(
    `SELECT ${CARD_COLUMNS} ${from} ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  return { items: rows.map(toCard), page, limit, total };
}

// 5.4 GET /api/home — ใกล้จบ + ใหม่ล่าสุด
async function home() {
  const [ending] = await db.query(
    `SELECT ${CARD_COLUMNS} FROM listings l
      WHERE l.status = 'active' AND l.end_at > UTC_TIMESTAMP()
      ORDER BY l.end_at ASC LIMIT ?`,
    [HOME_SIZE],
  );
  const [newest] = await db.query(
    `SELECT ${CARD_COLUMNS} FROM listings l
      WHERE l.status = 'active' AND l.end_at > UTC_TIMESTAMP()
      ORDER BY l.start_at DESC, l.id DESC LIMIT ?`,
    [HOME_SIZE],
  );
  return { endingSoon: ending.map(toCard), newest: newest.map(toCard) };
}

// สิทธิ์เห็นสินค้า: สาธารณะเห็นเฉพาะ active/ended เจ้าของและแอดมินเห็นทุกสถานะ (api-spec 5.2)
function canSee(row, user) {
  if (PUBLIC_STATUSES.includes(row.status)) return true;
  if (!user) return false;
  return String(user.id) === String(row.seller_id) || ['admin', 'super_admin'].includes(user.role);
}

/**
 * 5.2 GET /api/listings/:id — ListingDetail
 * @param {number} listingId
 * @param {object|null} user ผู้ใช้ที่ login (null = Guest)
 */
async function detail(listingId, user) {
  const [[r]] = await db.query(
    `SELECT l.*, c.name AS cat_name, p.id AS parent_cat_id, p.name AS parent_cat_name,
            u.display_name AS seller_display_name, sp.shop_name
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       JOIN users u ON u.id = l.seller_id
       LEFT JOIN seller_profiles sp ON sp.user_id = l.seller_id
      WHERE l.id = ?`,
    [listingId],
  );
  if (!r || !canSee(r, user)) throw new AppError(404, 'NOT_FOUND', 'ไม่พบสินค้านี้');

  const [images] = await db.query(
    'SELECT id, file_path, is_cover FROM listing_images WHERE listing_id = ? ORDER BY is_cover DESC, sort_order ASC, id ASC',
    [listingId],
  );

  const engine = {
    status: r.status,
    startPrice: toSatang(r.start_price),
    bidIncrement: toSatang(r.bid_increment),
    currentPrice: toSatang(r.current_price),
    buyNowPrice: toSatang(r.buy_now_price),
  };
  const reserve = toSatang(r.reserve_price);
  const isOwner = Boolean(user) && String(user.id) === String(r.seller_id);
  const isAdmin = Boolean(user) && ['admin', 'super_admin'].includes(user.role);

  let me = null;
  if (user) {
    const [[w]] = await db.query('SELECT 1 AS x FROM watchlists WHERE user_id = ? AND listing_id = ?', [user.id, listingId]);
    const [[p]] = await db.query('SELECT max_amount, is_active FROM proxy_bids WHERE listing_id = ? AND bidder_id = ?', [listingId, user.id]);
    me = {
      isOwner,
      isLeading: r.current_bidder_id !== null && String(r.current_bidder_id) === String(user.id),
      inWatchlist: Boolean(w),
      proxy: p ? { maxAmount: Number(p.max_amount), isActive: Boolean(p.is_active) } : null, // ของตัวเองเท่านั้น
    };
  }

  const out = {
    id: r.id,
    title: r.title,
    description: r.description,
    includedItems: r.included_items,
    itemCondition: r.item_condition,
    defectDetail: r.defect_detail,
    category: {
      id: r.category_id,
      name: r.cat_name,
      parent: r.parent_cat_id ? { id: r.parent_cat_id, name: r.parent_cat_name } : null,
    },
    images: images.map((i) => ({ id: i.id, url: `/uploads/products/${i.file_path}`, isCover: Boolean(i.is_cover) })),
    shippingFee: num(r.shipping_fee),
    originProvince: r.origin_province,
    startPrice: num(r.start_price),
    bidIncrement: num(r.bid_increment),
    currentPrice: num(r.current_price),
    minNextBid: Number((minNextBid(engine) / 100).toFixed(2)),
    buyNowPrice: num(r.buy_now_price),
    buyNowAvailable: isBuyNowAvailable(engine),
    reserveMet: reserve === null ? null : engine.currentPrice !== null && engine.currentPrice >= reserve,
    bidCount: r.bid_count,
    status: r.status,
    result: r.result,
    startAt: isoOrNull(r.start_at),
    endAt: isoOrNull(r.end_at),
    extendCount: r.extend_count,
    maxExtendCount: time.autoExtendMaxCount,
    serverTime: new Date().toISOString(),
    seller: { id: r.seller_id, displayName: r.seller_display_name, shopName: r.shop_name || r.seller_display_name },
    me,
  };
  if (isOwner || isAdmin) out.reservePrice = num(r.reserve_price); // api-spec 0.5
  return out;
}

/**
 * 5.3 GET /api/listings/:id/bids — ประวัติการบิด ปิดชื่อแบบ a***3 (D-16)
 */
async function bidHistory(listingId, user, { page, limit }) {
  const [[l]] = await db.query('SELECT id, status, seller_id FROM listings WHERE id = ?', [listingId]);
  if (!l || !canSee(l, user)) throw new AppError(404, 'NOT_FOUND', 'ไม่พบสินค้านี้');
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM bids WHERE listing_id = ?', [listingId]);
  const [rows] = await db.query(
    `SELECT b.bidder_id, b.amount, b.bid_type, b.created_at, u.username
       FROM bids b JOIN users u ON u.id = b.bidder_id
      WHERE b.listing_id = ? ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`,
    [listingId, limit, (page - 1) * limit],
  );
  return {
    items: rows.map((b) => ({
      bidder: maskUsername(b.username),
      isMe: Boolean(user) && String(user.id) === String(b.bidder_id),
      amount: Number(b.amount),
      bidType: b.bid_type === 'proxy' ? 'auto' : b.bid_type,
      createdAt: isoOrNull(b.created_at),
    })),
    page,
    limit,
    total,
  };
}

/**
 * 6.6 GET /api/me/bids — การประมูลของฉัน
 * @param {number} userId
 * @param {'active'|'ended'|undefined} status ไม่ส่ง = ทั้งหมด
 */
async function myBids(userId, status) {
  if (status !== undefined && status !== '' && !PUBLIC_STATUSES.includes(status)) {
    throw validationError({ status: 'สถานะต้องเป็น active หรือ ended' });
  }
  const params = [userId];
  let filter = "l.status IN ('active', 'ended')";
  if (status) { filter = 'l.status = ?'; params.push(status); }
  const [rows] = await db.query(
    `SELECT ${CARD_COLUMNS}, l.current_bidder_id, l.result, l.winner_id, mb.my_highest
       FROM (SELECT listing_id, MAX(amount) AS my_highest FROM bids WHERE bidder_id = ? GROUP BY listing_id) mb
       JOIN listings l ON l.id = mb.listing_id
      WHERE ${filter}
      ORDER BY (l.status = 'active') DESC, l.end_at ASC`,
    params,
  );
  return {
    items: rows.map((r) => ({
      ...toCard(r),
      myHighestBid: Number(r.my_highest),
      isLeading: r.status === 'active' && String(r.current_bidder_id) === String(userId),
      result: r.result,
      won: r.winner_id !== null && String(r.winner_id) === String(userId),
    })),
  };
}

// 6.7 GET /api/me/won — รายการที่ชนะ (มี Order แล้ว)
async function myWon(userId) {
  const [rows] = await db.query(
    `SELECT o.id AS order_id, o.status AS order_status, o.payment_due_at, o.item_price, o.created_at,
            l.id AS listing_id, l.title,
            (SELECT CONCAT('/uploads/products/', li.file_path) FROM listing_images li
              WHERE li.listing_id = l.id AND li.is_cover = 1 LIMIT 1) AS cover_url
       FROM orders o JOIN listings l ON l.id = o.listing_id
      WHERE o.buyer_id = ? ORDER BY o.created_at DESC, o.id DESC`,
    [userId],
  );
  return {
    items: rows.map((r) => ({
      listingId: r.listing_id,
      title: r.title,
      coverUrl: r.cover_url || null,
      price: Number(r.item_price),
      orderId: r.order_id,
      orderStatus: r.order_status,
      paymentDueAt: isoOrNull(r.payment_due_at),
    })),
  };
}

module.exports = { search, home, detail, bidHistory, myBids, myWon, toCard, CARD_COLUMNS };
