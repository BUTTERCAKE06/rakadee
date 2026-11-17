// Auth Middleware — ข้อ 0.2, 0.3, 1 ใน docs/api-spec/api-spec.md (เจ้าของ: SA)
// กติกา:
//   - requireAuth: ตรวจ Session Token จาก header Authorization: Bearer <token>
//   - requireRole(...roles): ตรวจบทบาท (bidder, seller, admin, super_admin, member)
//   - requireActiveAccount(action): ตรวจสถานะบัญชีตาม action ('login', 'bid', 'sell', 'pay')
const crypto = require('crypto');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Hash token ด้วย SHA-256 เพื่อเปรียบเทียบกับ sessions.token_hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token.trim() : null;
}

/**
 * หา user จาก token ที่ยังไม่หมดอายุและไม่ถูก revoke ใช้ร่วมกับ Socket.IO
 */
async function findUserByToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [rows] = await pool.query(
    `SELECT
      s.id AS session_id,
      s.expires_at,
      s.revoked_at,
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.display_name,
      u.phone,
      u.id_card_last4,
      u.avatar_path,
      u.bio,
      u.role,
      u.status,
      u.status_until,
      u.status_reason,
      u.phone_verified_at,
      u.email_verified_at,
      u.created_at,
      (sp.id IS NOT NULL) AS is_seller
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN seller_profiles sp ON sp.user_id = u.id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    email: r.email,
    username: r.username,
    fullName: r.full_name,
    displayName: r.display_name,
    phone: r.phone,
    idCardLast4: r.id_card_last4,
    avatarUrl: r.avatar_path ? `/uploads/${r.avatar_path}` : null,
    bio: r.bio,
    role: r.role,
    status: r.status,
    statusUntil: r.status_until ? new Date(r.status_until).toISOString() : null,
    statusReason: r.status_reason,
    phoneVerified: Boolean(r.phone_verified_at),
    emailVerified: Boolean(r.email_verified_at),
    isSeller: Boolean(r.is_seller),
    sessionId: Number(r.session_id),
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/**
 * Middleware ตรวจสอบการเข้าสู่ระบบผ่าน Session Token (D-12)
 * แนบ req.user และ req.session ให้ handler ถัดไป
 */
async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
    }

    const tokenHash = hashToken(token);

    // ดึง session พร้อมข้อมูล user
    const [rows] = await pool.query(
      `SELECT
        s.id AS session_id,
        s.expires_at,
        s.revoked_at,
        u.id,
        u.email,
        u.username,
        u.full_name,
        u.display_name,
        u.phone,
        u.id_card_last4,
        u.avatar_path,
        u.bio,
        u.role,
        u.status,
        u.status_until,
        u.status_reason,
        u.phone_verified_at,
        u.email_verified_at,
        u.created_at,
        (sp.id IS NOT NULL) AS is_seller
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN seller_profiles sp ON sp.user_id = u.id
       WHERE s.token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      throw new AppError(401, 'UNAUTHORIZED', 'เซสชันไม่ถูกต้องหรือถูกยกเลิกแล้ว');
    }

    const s = rows[0];

    // ตรวจสอบว่า session ถูกยกเลิกหรือหมดอายุหรือไม่
    if (s.revoked_at) {
      throw new AppError(401, 'UNAUTHORIZED', 'เซสชันนี้ถูกออกจากระบบแล้ว');
    }
    if (new Date(s.expires_at) <= new Date()) {
      throw new AppError(401, 'UNAUTHORIZED', 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
    }

    // ตรวจสอบสถานะบัญชีขั้นพื้นฐาน: banned เข้าสู่ระบบไม่ได้ทุกกรณี
    if (s.status === 'banned') {
      throw new AppError(403, 'ACCOUNT_BANNED', 'บัญชีของคุณถูกระงับการใช้งานถาวร');
    }

    // อัปเดต last_seen_at แบบ asynchronous ไม่บล็อก response
    pool.query('UPDATE sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?', [s.session_id]).catch(() => {});

    // แนบข้อมูลผู้ใช้ลง req.user ตามโครงสร้าง UserMe
    req.user = {
      id: Number(s.id),
      email: s.email,
      username: s.username,
      fullName: s.full_name,
      displayName: s.display_name,
      phone: s.phone,
      idCardLast4: s.id_card_last4,
      avatarUrl: s.avatar_path ? `/uploads/${s.avatar_path}` : null,
      bio: s.bio,
      role: s.role,
      status: s.status,
      statusUntil: s.status_until ? new Date(s.status_until).toISOString() : null,
      statusReason: s.status_reason,
      phoneVerified: Boolean(s.phone_verified_at),
      emailVerified: Boolean(s.email_verified_at),
      isSeller: Boolean(s.is_seller),
      sessionId: Number(s.session_id),
      createdAt: new Date(s.created_at).toISOString(),
    };

    req.session = {
      id: Number(s.session_id),
      expiresAt: s.expires_at,
    };

    next();
  } catch (err) {
    next(err);
  }
}

// กลุ่ม role ตาม api-spec 0.3
const ROLE_GROUPS = {
  member: ['bidder', 'seller'],
  seller: ['seller'],
  admin: ['admin', 'super_admin'],
  super_admin: ['super_admin'],
};

/**
 * Middleware ตรวจสอบ Role ของผู้ใช้ (รองรับทั้งชื่อ role เดี่ยวๆ หรือชื่อกลุ่มเช่น member, admin)
 */
function requireRole(...groups) {
  const allowed = new Set(groups.flatMap((g) => ROLE_GROUPS[g] || [g]));
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ'));
    }
    if (!allowed.has(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้'));
    }
    next();
  };
}

// ตารางสิทธิ์ตามสถานะบัญชี (api-spec 0.3)
const STATUS_RULES = {
  bid: { active: true, restricted: true },
  sell: { active: true },
  pay: { active: true, restricted: true, suspended: true },
  login: { active: true, restricted: true, suspended: true, pending_verification: true },
};

const STATUS_ERRORS = {
  pending_verification: ['ACCOUNT_NOT_VERIFIED', 'กรุณายืนยันรหัส OTP ก่อนทำรายการ'],
  restricted: ['ACCOUNT_RESTRICTED', 'บัญชีของคุณถูกจำกัดสิทธิ์การลงสินค้า'],
  suspended: ['ACCOUNT_SUSPENDED', 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว'],
  banned: ['ACCOUNT_BANNED', 'บัญชีของคุณถูกระงับการใช้งานถาวร'],
};

/**
 * Middleware ตรวจสอบสถานะบัญชีตาม Action ที่กำหนด (ตาราง 0.3 ใน docs/api-spec/api-spec.md)
 * @param {'bid'|'sell'|'pay'|'login'} action
 */
function requireActiveAccount(action = 'bid') {
  const rule = STATUS_RULES[action];
  if (!rule) throw new Error(`Unknown account action: ${action}`);

  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ'));
    }

    const { status, statusUntil } = req.user;
    if (rule[status]) return next();

    const [code, message] = STATUS_ERRORS[status] || ['FORBIDDEN', 'สถานะบัญชีไม่สามารถดำเนินการนี้ได้'];
    const details = statusUntil ? { until: statusUntil } : undefined;
    next(new AppError(403, code, message, details));
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireActiveAccount,
  findUserByToken,
  hashToken,
};
