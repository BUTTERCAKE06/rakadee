// Settings: โปรไฟล์ ที่อยู่ ตั้งค่าแจ้งเตือน (เจ้าของ: PM) — api-spec 1.7 (UserMe) และ 2.1–2.11
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');
const config = require('../config');
const AppError = require('../utils/AppError');

const MAX_ADDRESSES = 10;
const fileUrl = (p) => (p ? `/uploads/${p}` : null);

function validationError(errors) {
  return new AppError(400, 'VALIDATION_ERROR', 'กรุณาตรวจสอบข้อมูลที่กรอก', errors);
}

// ---------------------------------------------------------------- UserMe (1.7)
async function getMe(userId) {
  const [rows] = await db.pool.query(
    `SELECT u.*, (sp.id IS NOT NULL) AS is_seller
       FROM users u LEFT JOIN seller_profiles sp ON sp.user_id = u.id
      WHERE u.id = ?`,
    [userId],
  );
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้');
  const u = rows[0];
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.full_name,
    displayName: u.display_name,
    phone: u.phone,
    idCardLast4: u.id_card_last4,
    avatarUrl: fileUrl(u.avatar_path),
    bio: u.bio,
    role: u.role,
    status: u.status,
    statusUntil: u.status_until,
    statusReason: u.status_reason,
    phoneVerified: !!u.phone_verified_at,
    emailVerified: !!u.email_verified_at,
    isSeller: !!u.is_seller,
    createdAt: u.created_at,
  };
}

// ---------------------------------------------------------------- 2.1 PATCH /users/me
async function updateProfile(userId, body) {
  const errors = {};
  const sets = [];
  const params = [];
  if (body.displayName !== undefined) {
    const v = String(body.displayName).trim();
    if (v.length < 2 || v.length > 50) errors.displayName = 'ชื่อที่แสดงต้องยาว 2–50 ตัวอักษร';
    sets.push('display_name = ?');
    params.push(v);
  }
  if (body.bio !== undefined) {
    const v = body.bio === null ? '' : String(body.bio).trim();
    if (v.length > 500) errors.bio = 'คำแนะนำตัวต้องไม่เกิน 500 ตัวอักษร';
    sets.push('bio = ?');
    params.push(v || null);
  }
  if (Object.keys(errors).length) throw validationError(errors);
  if (!sets.length) throw validationError({ displayName: 'ไม่มีข้อมูลที่ต้องแก้ไข' });
  await db.pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, userId]);
  return getMe(userId);
}

// ---------------------------------------------------------------- 2.2 / 2.3 รูปโปรไฟล์
async function removeFile(relPath) {
  if (!relPath) return;
  try {
    await fs.unlink(path.join(config.upload.dir, relPath));
  } catch {
    // ไฟล์หายไปแล้วก็ไม่เป็นไร
  }
}

async function setAvatar(userId, file) {
  if (!file) throw validationError({ avatar: 'กรุณาเลือกรูปภาพ' });
  const newPath = `avatars/${file.filename}`;
  const [[user]] = await db.pool.query('SELECT avatar_path FROM users WHERE id = ?', [userId]);
  await db.pool.query('UPDATE users SET avatar_path = ? WHERE id = ?', [newPath, userId]);
  await removeFile(user && user.avatar_path);
  return { avatarUrl: fileUrl(newPath) };
}

async function removeAvatar(userId) {
  const [[user]] = await db.pool.query('SELECT avatar_path FROM users WHERE id = ?', [userId]);
  await db.pool.query('UPDATE users SET avatar_path = NULL WHERE id = ?', [userId]);
  await removeFile(user && user.avatar_path);
  return { avatarUrl: null };
}

// ---------------------------------------------------------------- 2.4–2.8 ที่อยู่
function formatAddress(r) {
  return {
    id: r.id,
    recipientName: r.recipient_name,
    phone: r.phone,
    addressLine: r.address_line,
    subDistrict: r.sub_district,
    district: r.district,
    province: r.province,
    postalCode: r.postal_code,
    isDefault: !!r.is_default,
  };
}

function validateAddress(body) {
  const v = {
    recipientName: String(body.recipientName || '').trim(),
    phone: String(body.phone || '').replace(/[\s-]/g, ''),
    addressLine: String(body.addressLine || '').trim(),
    subDistrict: String(body.subDistrict || '').trim(),
    district: String(body.district || '').trim(),
    province: String(body.province || '').trim(),
    postalCode: String(body.postalCode || '').trim(),
  };
  const errors = {};
  if (!v.recipientName) errors.recipientName = 'กรุณากรอกชื่อผู้รับ';
  else if (v.recipientName.length > 150) errors.recipientName = 'ชื่อผู้รับยาวเกินไป';
  if (!/^0\d{9}$/.test(v.phone)) errors.phone = 'เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0';
  if (!v.addressLine) errors.addressLine = 'กรุณากรอกบ้านเลขที่ ถนน ซอย';
  else if (v.addressLine.length > 255) errors.addressLine = 'ที่อยู่ยาวเกินไป';
  if (!v.subDistrict) errors.subDistrict = 'กรุณากรอกตำบล / แขวง';
  if (!v.district) errors.district = 'กรุณากรอกอำเภอ / เขต';
  if (!v.province) errors.province = 'กรุณากรอกจังหวัด';
  if (!/^\d{5}$/.test(v.postalCode)) errors.postalCode = 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก';
  for (const k of ['subDistrict', 'district', 'province']) {
    if (v[k].length > 100 && !errors[k]) errors[k] = 'ข้อความยาวเกินไป';
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return v;
}

async function listAddresses(userId) {
  const [rows] = await db.pool.query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at ASC, id ASC',
    [userId],
  );
  return { items: rows.map(formatAddress) };
}

async function getOwnedAddress(conn, userId, id) {
  const [rows] = await conn.query('SELECT * FROM addresses WHERE id = ? AND user_id = ? FOR UPDATE', [id, userId]);
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'ไม่พบที่อยู่นี้');
  return rows[0];
}

async function createAddress(userId, body) {
  const v = validateAddress(body);
  return db.withTransaction(async (conn) => {
    // ล็อกแถว user เพื่อกันเพิ่มที่อยู่พร้อมกันจนได้ค่าเริ่มต้น 2 อัน
    await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [userId]);
    if (n >= MAX_ADDRESSES) throw new AppError(400, 'ADDRESS_LIMIT', `เพิ่มที่อยู่ได้สูงสุด ${MAX_ADDRESSES} ที่`);
    const [result] = await conn.query(
      `INSERT INTO addresses (user_id, recipient_name, phone, address_line, sub_district, district, province, postal_code, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, v.recipientName, v.phone, v.addressLine, v.subDistrict, v.district, v.province, v.postalCode, n === 0 ? 1 : 0],
    );
    const [[row]] = await conn.query('SELECT * FROM addresses WHERE id = ?', [result.insertId]);
    return formatAddress(row);
  });
}

async function updateAddress(userId, id, body) {
  const v = validateAddress(body);
  return db.withTransaction(async (conn) => {
    await getOwnedAddress(conn, userId, id);
    await conn.query(
      `UPDATE addresses SET recipient_name = ?, phone = ?, address_line = ?, sub_district = ?, district = ?, province = ?, postal_code = ?
        WHERE id = ?`,
      [v.recipientName, v.phone, v.addressLine, v.subDistrict, v.district, v.province, v.postalCode, id],
    );
    const [[row]] = await conn.query('SELECT * FROM addresses WHERE id = ?', [id]);
    return formatAddress(row);
  });
}

async function deleteAddress(userId, id) {
  return db.withTransaction(async (conn) => {
    await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const addr = await getOwnedAddress(conn, userId, id);
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [userId]);
    if (n === 1) {
      const [[{ pending }]] = await conn.query(
        "SELECT COUNT(*) AS pending FROM orders WHERE buyer_id = ? AND status = 'pending_payment'",
        [userId],
      );
      if (pending) throw new AppError(409, 'LAST_DEFAULT_ADDRESS', 'ลบที่อยู่สุดท้ายไม่ได้ เพราะมีคำสั่งซื้อที่รอชำระเงิน');
    }
    await conn.query('DELETE FROM addresses WHERE id = ?', [id]);
    if (addr.is_default) {
      await conn.query(
        'UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY created_at ASC, id ASC LIMIT 1',
        [userId],
      );
    }
    return { id, deleted: true };
  });
}

async function setDefaultAddress(userId, id) {
  return db.withTransaction(async (conn) => {
    await getOwnedAddress(conn, userId, id);
    await conn.query('UPDATE addresses SET is_default = (id = ?) WHERE user_id = ?', [id, userId]);
    const [[row]] = await conn.query('SELECT * FROM addresses WHERE id = ?', [id]);
    return formatAddress(row);
  });
}

// ---------------------------------------------------------------- 2.9 / 2.10 ตั้งค่าแจ้งเตือน
const GROUPS = ['auction', 'finance', 'shipping'];

function formatSettings(row) {
  const out = {};
  for (const g of GROUPS) out[g] = { web: row ? !!row[`${g}_web`] : true, email: row ? !!row[`${g}_email`] : true };
  return out;
}

async function getNotificationSettings(userId) {
  const [rows] = await db.pool.query('SELECT * FROM notification_settings WHERE user_id = ?', [userId]);
  return formatSettings(rows[0]);
}

async function updateNotificationSettings(userId, body) {
  const errors = {};
  const values = [];
  for (const g of GROUPS) {
    const grp = body[g];
    if (!grp || typeof grp.web !== 'boolean' || typeof grp.email !== 'boolean') {
      errors[g] = 'ต้องระบุ { web: true|false, email: true|false }';
      continue;
    }
    values.push(grp.web ? 1 : 0, grp.email ? 1 : 0);
  }
  if (Object.keys(errors).length) throw validationError(errors);
  await db.pool.query(
    `INSERT INTO notification_settings (user_id, auction_web, auction_email, finance_web, finance_email, shipping_web, shipping_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE auction_web = VALUES(auction_web), auction_email = VALUES(auction_email),
       finance_web = VALUES(finance_web), finance_email = VALUES(finance_email),
       shipping_web = VALUES(shipping_web), shipping_email = VALUES(shipping_email)`,
    [userId, ...values],
  );
  return getNotificationSettings(userId);
}

// ---------------------------------------------------------------- 2.11 ข้อมูลสาธารณะ
async function getPublicUser(id) {
  const [rows] = await db.pool.query(
    `SELECT u.id, u.display_name, u.avatar_path, u.bio, u.created_at, u.role, u.phone_verified_at, u.email_verified_at,
            (sp.id IS NOT NULL) AS is_seller
       FROM users u LEFT JOIN seller_profiles sp ON sp.user_id = u.id
      WHERE u.id = ? AND u.role IN ('bidder', 'seller') AND u.status <> 'banned'`,
    [id],
  );
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้');
  const u = rows[0];
  return {
    id: u.id,
    displayName: u.display_name,
    avatarUrl: fileUrl(u.avatar_path),
    bio: u.bio,
    joinedAt: u.created_at,
    isSeller: !!u.is_seller,
    emailVerified: !!u.email_verified_at,
    phoneVerified: !!u.phone_verified_at,
  };
}

module.exports = {
  getMe,
  updateProfile,
  setAvatar,
  removeAvatar,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getNotificationSettings,
  updateNotificationSettings,
  getPublicUser,
};
