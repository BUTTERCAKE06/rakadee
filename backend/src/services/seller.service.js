// seller.service.js — เปิดสิทธิ์ผู้ขาย (api-spec 3.1–3.4)
// เจ้าของ: QA
const db = require('../config/db');
const AppError = require('../utils/AppError');

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

function formatProfile(row) {
  return {
    shopName: row.shop_name,
    shopDescription: row.shop_description,
    originProvince: row.origin_province,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
  };
}

// ----------------------------------------------------------------
// 3.1 POST /api/seller/profile — เปิดร้าน
// ----------------------------------------------------------------
async function openShop(userId, { shopName, shopDescription, originProvince }) {
  // validation
  const errors = {};
  if (!shopName || !shopName.trim()) errors.shopName = 'ชื่อร้านค้าต้องไม่ว่างเปล่า';
  if (!originProvince || !originProvince.trim()) errors.originProvince = 'จังหวัดต้นทางต้องไม่ว่างเปล่า';
  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ครบถ้วน', errors);
  }

  // ตรวจว่ามีร้านแล้วหรือยัง
  const [existing] = await db.query(
    'SELECT id FROM seller_profiles WHERE user_id = ?',
    [userId]
  );
  if (existing.length) {
    throw new AppError(409, 'ALREADY_SELLER', 'บัญชีนี้เปิดร้านไปแล้ว');
  }

  // สร้างร้านและเปลี่ยน role เป็น seller ใน transaction
  const result = await db.withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO seller_profiles (user_id, shop_name, shop_description, origin_province)
       VALUES (?, ?, ?, ?)`,
      [userId, shopName.trim(), shopDescription?.trim() || null, originProvince.trim()]
    );
    await conn.execute(
      `UPDATE users SET role = 'seller' WHERE id = ?`,
      [userId]
    );
    const [[row]] = await conn.execute(
      `SELECT shop_name, shop_description, origin_province, created_at
       FROM seller_profiles WHERE user_id = ?`,
      [userId]
    );
    return row;
  });

  return formatProfile(result);
}

// ----------------------------------------------------------------
// 3.2 GET /api/seller/profile — ข้อมูลร้านของฉัน
// ----------------------------------------------------------------
async function getMyProfile(userId) {
  const [[row]] = await db.query(
    `SELECT shop_name, shop_description, origin_province, created_at
     FROM seller_profiles WHERE user_id = ?`,
    [userId]
  );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลร้านค้า');
  return formatProfile(row);
}

// ----------------------------------------------------------------
// 3.3 PUT /api/seller/profile — แก้ข้อมูลร้าน
// ----------------------------------------------------------------
async function updateMyProfile(userId, { shopName, shopDescription, originProvince }) {
  const errors = {};
  if (shopName !== undefined && !shopName?.trim()) errors.shopName = 'ชื่อร้านค้าต้องไม่ว่างเปล่า';
  if (originProvince !== undefined && !originProvince?.trim()) errors.originProvince = 'จังหวัดต้นทางต้องไม่ว่างเปล่า';
  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', errors);
  }

  const [[existing]] = await db.query(
    'SELECT id FROM seller_profiles WHERE user_id = ?',
    [userId]
  );
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลร้านค้า');

  // สร้าง SET clause เฉพาะฟิลด์ที่ส่งมา
  const fields = [];
  const values = [];
  if (shopName !== undefined)       { fields.push('shop_name = ?');        values.push(shopName.trim()); }
  if (shopDescription !== undefined){ fields.push('shop_description = ?'); values.push(shopDescription?.trim() || null); }
  if (originProvince !== undefined)  { fields.push('origin_province = ?'); values.push(originProvince.trim()); }

  if (fields.length) {
    values.push(userId);
    await db.query(
      `UPDATE seller_profiles SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );
  }

  return getMyProfile(userId);
}

// ----------------------------------------------------------------
// 3.4 GET /api/sellers/:userId — โปรไฟล์สาธารณะ + สินค้ากำลังประมูล
// BE only (FE เป็นงานของ Programmer)
// ----------------------------------------------------------------
async function getPublicProfile(sellerUserId) {
  const [[profile]] = await db.query(
    `SELECT sp.shop_name, sp.shop_description, sp.origin_province,
            u.id, u.display_name, u.avatar_path, u.created_at AS joined_at
     FROM seller_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.user_id = ? AND u.role = 'seller'`,
    [sellerUserId]
  );
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลร้านค้า');

  // สินค้าที่กำลังประมูล (ListingCard)
  const [listings] = await db.query(
    `SELECT l.id, l.title,
            (SELECT CONCAT('/uploads/products/', li.file_path)
             FROM listing_images li
             WHERE li.listing_id = l.id AND li.is_cover = 1
             LIMIT 1) AS cover_url,
            l.item_condition, l.current_price, l.start_price,
            l.bid_count, l.buy_now_price, l.shipping_fee,
            l.status, l.end_at, l.category_id
     FROM listings l
     WHERE l.seller_id = ? AND l.status = 'active'
     ORDER BY l.end_at ASC`,
    [sellerUserId]
  );

  return {
    userId: profile.id,
    shopName: profile.shop_name,
    shopDescription: profile.shop_description,
    originProvince: profile.origin_province,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_path ? `/uploads/avatars/${profile.avatar_path}` : null,
    joinedAt: profile.joined_at ? profile.joined_at.toISOString() : null,
    activeListings: listings.map(formatListingCard),
  };
}

// ListingCard ย่อ (ใช้ใน public profile)
function formatListingCard(row) {
  return {
    id: row.id,
    title: row.title,
    coverUrl: row.cover_url || null,
    itemCondition: row.item_condition,
    currentPrice: row.current_price !== null ? Number(row.current_price) : null,
    startPrice: Number(row.start_price),
    bidCount: row.bid_count,
    buyNowPrice: row.buy_now_price !== null ? Number(row.buy_now_price) : null,
    shippingFee: Number(row.shipping_fee),
    status: row.status,
    endAt: row.end_at ? row.end_at.toISOString() : null,
    categoryId: row.category_id,
  };
}

module.exports = { openShop, getMyProfile, updateMyProfile, getPublicProfile };
