// seller.service.js — เปิดสิทธิ์ผู้ขาย + แอดมินตรวจร้าน (api-spec 3.1–3.8, D-18)
// เจ้าของ: QA
//
// Flow (D-18):
//   ยื่นขอเปิดร้าน (3.1) → seller_profiles.status = pending (role ยังเป็น bidder ลงสินค้าไม่ได้)
//   แอดมินอนุมัติ (3.7)   → status = approved + users.role = seller + notify + audit
//   แอดมินไม่อนุมัติ (3.8) → status = rejected + reject_reason + notify + audit → ผู้ใช้แก้แล้วยื่นใหม่ผ่าน 3.1
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { notify, EVENTS } = require('./notify');
const audit = require('./audit');

const PROFILE_STATUSES = ['pending', 'approved', 'rejected'];
const iso = (d) => (d ? new Date(d).toISOString() : null);

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

function formatAddress(row) {
  if (!row || !row.a_id) return null;
  return {
    id: row.a_id,
    recipientName: row.a_recipient_name,
    phone: row.a_phone,
    addressLine: row.a_address_line,
    subDistrict: row.a_sub_district,
    district: row.a_district,
    province: row.a_province,
    postalCode: row.a_postal_code,
    isDefault: Boolean(row.a_is_default),
  };
}

// SellerProfile ตาม api-spec 3
function formatProfile(row) {
  return {
    shopName: row.shop_name,
    shopDescription: row.shop_description,
    originProvince: row.origin_province,
    address: formatAddress(row),
    status: row.status,
    rejectReason: row.reject_reason,
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at),
    createdAt: iso(row.created_at),
  };
}

const PROFILE_SELECT = `
  SELECT sp.*, a.id AS a_id, a.recipient_name AS a_recipient_name, a.phone AS a_phone,
         a.address_line AS a_address_line, a.sub_district AS a_sub_district, a.district AS a_district,
         a.province AS a_province, a.postal_code AS a_postal_code, a.is_default AS a_is_default
    FROM seller_profiles sp
    LEFT JOIN addresses a ON a.id = sp.address_id`;

async function fetchProfileRow(userId, conn = db) {
  const [[row]] = await conn.query(`${PROFILE_SELECT} WHERE sp.user_id = ?`, [userId]);
  return row || null;
}

// validate body ของ 3.1 / 3.3 — คืนค่าที่ trim แล้ว
function validateShopBody({ shopName, shopDescription, originProvince, addressId }) {
  const errors = {};
  const name = typeof shopName === 'string' ? shopName.trim() : '';
  const desc = typeof shopDescription === 'string' ? shopDescription.trim() : '';
  const province = typeof originProvince === 'string' ? originProvince.trim() : '';

  if (!name) errors.shopName = 'กรุณากรอกชื่อร้าน';
  else if (name.length > 100) errors.shopName = 'ชื่อร้านต้องไม่เกิน 100 ตัวอักษร';
  if (desc.length > 1000) errors.shopDescription = 'รายละเอียดร้านต้องไม่เกิน 1000 ตัวอักษร';
  if (!province) errors.originProvince = 'กรุณาเลือกจังหวัดต้นทาง';
  else if (province.length > 100) errors.originProvince = 'จังหวัดต้องไม่เกิน 100 ตัวอักษร';

  if (Object.keys(errors).length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลร้านไม่ถูกต้อง', errors);
  }

  // addressId บังคับ (D-18) — แยก error code ตาม api-spec 3.1
  const addrId = Number(addressId);
  if (addressId === undefined || addressId === null || addressId === '' || !Number.isInteger(addrId) || addrId <= 0) {
    throw new AppError(400, 'ADDRESS_REQUIRED', 'กรุณาเลือกที่อยู่ส่งของ/รับคืนจากสมุดที่อยู่');
  }

  return { name, desc: desc || null, province, addrId };
}

// addressId ต้องเป็นที่อยู่ของผู้ใช้คนนี้
async function assertOwnAddress(conn, userId, addressId) {
  const [[addr]] = await conn.query('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
  if (!addr) throw new AppError(400, 'ADDRESS_REQUIRED', 'ที่อยู่ที่เลือกไม่อยู่ในสมุดที่อยู่ของคุณ');
}

// ----------------------------------------------------------------
// 3.1 POST /api/seller/profile — ยื่นขอเปิดร้าน (หรือยื่นใหม่หลัง rejected)
// ----------------------------------------------------------------
async function openShop(userId, body) {
  const { name, desc, province, addrId } = validateShopBody(body || {});

  const row = await db.withTransaction(async (conn) => {
    const [[user]] = await conn.query(
      'SELECT id, role, email_verified_at FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้');
    if (user.role === 'seller') throw new AppError(409, 'ALREADY_SELLER', 'บัญชีนี้เป็นผู้ขายแล้ว');
    if (!user.email_verified_at) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'กรุณายืนยันอีเมลก่อนยื่นขอเปิดร้าน');
    }
    await assertOwnAddress(conn, userId, addrId);

    const [[existing]] = await conn.query(
      'SELECT id, status FROM seller_profiles WHERE user_id = ? FOR UPDATE',
      [userId],
    );

    if (!existing) {
      await conn.query(
        `INSERT INTO seller_profiles (user_id, shop_name, shop_description, origin_province, address_id, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP())`,
        [userId, name, desc, province, addrId],
      );
    } else if (existing.status === 'pending') {
      throw new AppError(409, 'APPLICATION_PENDING', 'มีคำขอเปิดร้านที่รอแอดมินตรวจอยู่แล้ว');
    } else if (existing.status === 'approved') {
      // ร้าน approved แต่ role ไม่ใช่ seller (ข้อมูลไม่ตรงกัน) ถือว่าเป็นผู้ขายแล้ว
      throw new AppError(409, 'ALREADY_SELLER', 'ร้านของคุณได้รับการอนุมัติแล้ว');
    } else {
      // rejected → ยื่นใหม่ path เดิม (api-spec 3.1)
      await conn.query(
        `UPDATE seller_profiles
            SET shop_name = ?, shop_description = ?, origin_province = ?, address_id = ?,
                status = 'pending', reject_reason = NULL, submitted_at = UTC_TIMESTAMP(),
                reviewed_by = NULL, reviewed_at = NULL
          WHERE id = ?`,
        [name, desc, province, addrId, existing.id],
      );
    }
    return fetchProfileRow(userId, conn);
  });

  return formatProfile(row);
}

// ----------------------------------------------------------------
// 3.2 GET /api/seller/profile — ใบสมัคร/ร้านของฉัน หรือ null
// ----------------------------------------------------------------
async function getMyProfile(userId) {
  const row = await fetchProfileRow(userId);
  return row ? formatProfile(row) : null;
}

// ----------------------------------------------------------------
// 3.3 PUT /api/seller/profile — แก้ข้อมูลร้าน (เฉพาะ seller, ไม่ต้องตรวจซ้ำ)
// ----------------------------------------------------------------
async function updateMyProfile(userId, body) {
  const { name, desc, province, addrId } = validateShopBody(body || {});

  const row = await db.withTransaction(async (conn) => {
    const [[existing]] = await conn.query(
      'SELECT id, status FROM seller_profiles WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    if (!existing || existing.status !== 'approved') {
      throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลร้านค้าที่อนุมัติแล้ว');
    }
    await assertOwnAddress(conn, userId, addrId);
    await conn.query(
      `UPDATE seller_profiles SET shop_name = ?, shop_description = ?, origin_province = ?, address_id = ?
        WHERE id = ?`,
      [name, desc, province, addrId, existing.id],
    );
    return fetchProfileRow(userId, conn);
  });

  return formatProfile(row);
}

// ----------------------------------------------------------------
// 3.4 GET /api/sellers/:userId — โปรไฟล์สาธารณะ (เฉพาะร้าน approved)
// ----------------------------------------------------------------
async function getPublicProfile(sellerUserId) {
  const [[profile]] = await db.query(
    `SELECT sp.shop_name, sp.shop_description, sp.origin_province,
            u.id, u.display_name, u.avatar_path, u.created_at AS joined_at
       FROM seller_profiles sp
       JOIN users u ON u.id = sp.user_id
      WHERE sp.user_id = ? AND sp.status = 'approved' AND u.role = 'seller'`,
    [sellerUserId],
  );
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลร้านค้า');

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
    [sellerUserId],
  );

  return {
    userId: profile.id,
    shopName: profile.shop_name,
    shopDescription: profile.shop_description,
    originProvince: profile.origin_province,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_path ? `/uploads/avatars/${profile.avatar_path}` : null,
    joinedAt: iso(profile.joined_at),
    activeListings: listings.map(formatListingCard),
  };
}

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
    endAt: iso(row.end_at),
    categoryId: row.category_id,
  };
}

// ================================================================
// แอดมินตรวจร้าน (api-spec 3.5–3.8)
// ================================================================

// 3.5 GET /api/admin/seller-applications
async function listApplications({ status = 'pending', q, page, limit }) {
  if (!PROFILE_STATUSES.includes(status)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'สถานะไม่ถูกต้อง', { status: 'ใช้ได้เฉพาะ pending, approved, rejected' });
  }
  const where = ['sp.status = ?'];
  const params = [status];
  if (q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    where.push('(sp.shop_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    params.push(like, like, like);
  }
  const whereSql = where.join(' AND ');

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM seller_profiles sp JOIN users u ON u.id = sp.user_id WHERE ${whereSql}`,
    params,
  );
  const [rows] = await db.query(
    `SELECT sp.user_id, sp.shop_name, sp.origin_province, sp.status, sp.submitted_at,
            u.username, u.display_name, u.email_verified_at, u.phone_verified_at,
            TIMESTAMPDIFF(DAY, u.created_at, UTC_TIMESTAMP()) AS account_age_days,
            (SELECT COUNT(*) FROM penalties p WHERE p.user_id = u.id) AS penalty_count
       FROM seller_profiles sp
       JOIN users u ON u.id = sp.user_id
      WHERE ${whereSql}
      ORDER BY sp.submitted_at ASC, sp.id ASC
      LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );

  return {
    items: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      shopName: r.shop_name,
      originProvince: r.origin_province,
      status: r.status,
      submittedAt: iso(r.submitted_at),
      emailVerified: Boolean(r.email_verified_at),
      phoneVerified: Boolean(r.phone_verified_at),
      accountAgeDays: Number(r.account_age_days),
      penaltyCount: Number(r.penalty_count),
    })),
    page,
    limit,
    total: Number(total),
  };
}

// 3.6 GET /api/admin/seller-applications/:userId
async function getApplication(userId) {
  const row = await fetchProfileRow(userId);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอเปิดร้าน');

  const [[user]] = await db.query(
    `SELECT id, username, full_name, display_name, email, phone, id_card_last4, status,
            email_verified_at, phone_verified_at, created_at
       FROM users WHERE id = ?`,
    [userId],
  );
  const [[stats]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM bids WHERE bidder_id = ?) AS bid_count,
       (SELECT COUNT(*) FROM listings WHERE winner_id = ?) AS won_count,
       (SELECT COUNT(*) FROM orders WHERE buyer_id = ? AND status = 'completed') AS completed_orders,
       (SELECT COUNT(*) FROM orders WHERE buyer_id = ? AND status = 'cancelled') AS cancelled_orders`,
    [userId, userId, userId, userId],
  );
  const [penalties] = await db.query(
    'SELECT type, action, created_at, note FROM penalties WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      displayName: user.display_name,
      email: user.email,
      phone: user.phone,
      idCardLast4: user.id_card_last4,
      status: user.status,
      emailVerified: Boolean(user.email_verified_at),
      phoneVerified: Boolean(user.phone_verified_at),
      createdAt: iso(user.created_at),
    },
    profile: formatProfile(row),
    stats: {
      bidCount: Number(stats.bid_count),
      wonCount: Number(stats.won_count),
      completedOrders: Number(stats.completed_orders),
      cancelledOrders: Number(stats.cancelled_orders),
    },
    penalties: penalties.map((p) => ({ type: p.type, action: p.action, createdAt: iso(p.created_at), note: p.note })),
  };
}

// 3.7 POST /api/admin/seller-applications/:userId/approve
async function approveApplication(userId, adminId, ip) {
  await db.withTransaction(async (conn) => {
    const [[sp]] = await conn.query('SELECT id, status FROM seller_profiles WHERE user_id = ? FOR UPDATE', [userId]);
    if (!sp) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอเปิดร้าน');
    if (sp.status !== 'pending') {
      throw new AppError(409, 'INVALID_STATE', 'คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ', { status: sp.status });
    }
    // บัญชีที่ถูกแบนระหว่างรอตรวจ ห้ามอนุมัติเป็นผู้ขาย (ไม่อนุมัติได้ตามปกติ)
    const [[u]] = await conn.query('SELECT status FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (u.status === 'banned') {
      throw new AppError(409, 'INVALID_STATE', 'บัญชีนี้ถูกแบนอยู่ อนุมัติเป็นผู้ขายไม่ได้', { status: u.status });
    }
    await conn.query(
      `UPDATE seller_profiles SET status = 'approved', reject_reason = NULL, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
        WHERE id = ?`,
      [adminId, sp.id],
    );
    await conn.query("UPDATE users SET role = 'seller' WHERE id = ? AND role = 'bidder'", [userId]);
  });

  await notify(userId, EVENTS.SELLER_APPROVED, {});
  await audit.log(adminId, 'SELLER_APPROVE', 'user', userId, ip);
  return { userId, status: 'approved', role: 'seller' };
}

// 3.8 POST /api/admin/seller-applications/:userId/reject
async function rejectApplication(userId, adminId, ip, reason) {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!text) throw new AppError(400, 'REASON_REQUIRED', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
  if (text.length > 500) throw new AppError(400, 'VALIDATION_ERROR', 'เหตุผลต้องไม่เกิน 500 ตัวอักษร', { reason: 'ไม่เกิน 500 ตัวอักษร' });

  await db.withTransaction(async (conn) => {
    const [[sp]] = await conn.query('SELECT id, status FROM seller_profiles WHERE user_id = ? FOR UPDATE', [userId]);
    if (!sp) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอเปิดร้าน');
    if (sp.status !== 'pending') {
      throw new AppError(409, 'INVALID_STATE', 'คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ', { status: sp.status });
    }
    await conn.query(
      `UPDATE seller_profiles SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
        WHERE id = ?`,
      [text, adminId, sp.id],
    );
  });

  await notify(userId, EVENTS.SELLER_REJECTED, { reason: text });
  await audit.log(adminId, 'SELLER_REJECT', 'user', userId, ip, { reason: text });
  return { userId, status: 'rejected' };
}

module.exports = {
  openShop,
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
};
