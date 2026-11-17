// Auth Middleware — ข้อ 0.2, 0.3, 1 ใน docs/api-spec/api-spec.md
// กติกา:
//   - requireAuth: ตรวจ Session Token จาก header Authorization: Bearer <token>
//   - requireRole(...roles): ตรวจบทบาท (bidder, seller, admin, super_admin)
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

/**
 * Middleware ตรวจสอบการเข้าสู่ระบบผ่าน Session Token (D-12)
 * แนบ req.user และ req.session ให้ handler ถัดไป
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'โทเค็นไม่ถูกต้องหรือหมดอายุ');
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
        u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
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
      avatarUrl: s.avatar_path ? `/uploads/avatars/${s.avatar_path}` : null,
      bio: s.bio,
      role: s.role,
      status: s.status,
      statusUntil: s.status_until ? new Date(s.status_until).toISOString() : null,
      phoneVerified: Boolean(s.phone_verified_at),
      emailVerified: Boolean(s.email_verified_at),
      isSeller: s.role === 'seller',
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

/**
 * Middleware ตรวจสอบบทบาทของผู้ใช้ (Role)
 * @param {...string} roles บทบาทที่อนุญาต ('bidder', 'seller', 'admin', 'super_admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ'));
    }

    const userRole = req.user.role;
    // super_admin ครอบคลุมสิทธิ์ของ admin ด้วยเสมอ
    const isAllowed = roles.includes(userRole) || (userRole === 'super_admin' && roles.includes('admin'));

    if (!isAllowed) {
      return next(new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้'));
    }

    next();
  };
}

/**
 * Middleware ตรวจสอบสถานะบัญชีตาม Action ที่กำหนด (ตาราง 0.3 ใน docs/api-spec/api-spec.md)
 * @param {'bid'|'sell'|'pay'|'login'} action
 */
function requireActiveAccount(action = 'bid') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนทำรายการ'));
    }

    const status = req.user.status;
    const details = req.user.statusUntil ? { until: req.user.statusUntil } : undefined;

    // 1. ถูกแบนถาวร
    if (status === 'banned') {
      return next(new AppError(403, 'ACCOUNT_BANNED', 'บัญชีของคุณถูกระงับการใช้งานถาวร', details));
    }

    // 2. รอยืนยันตัวตน (ยังไม่ผ่าน OTP)
    if (status === 'pending_verification') {
      if (action === 'login') return next(); // เข้าสู่ระบบได้เพื่อไปหน้า OTP
      return next(new AppError(403, 'ACCOUNT_NOT_VERIFIED', 'กรุณายืนยันรหัส OTP ก่อนทำรายการ'));
    }

    // 3. ระงับการใช้งานชั่วคราว (suspended)
    if (status === 'suspended') {
      // ข้อยกเว้น: บัญชีที่ suspended ยังต้องจ่ายเงินหรือส่งของของ Order ที่ค้างอยู่ได้ (action = pay)
      if (action === 'pay') return next();
      return next(new AppError(403, 'ACCOUNT_SUSPENDED', 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว', details));
    }

    // 4. จำกัดสิทธิ์ (restricted - ผู้ขายไม่ส่งของซ้ำ)
    if (status === 'restricted') {
      // ถูกจำกัดเฉพาะการลงขาย/เปิดร้าน (action = sell) แต่บิดและจ่ายเงินได้ตามปกติ
      if (action === 'sell') {
        return next(new AppError(403, 'ACCOUNT_RESTRICTED', 'บัญชีของคุณถูกจำกัดสิทธิ์การลงสินค้า', details));
      }
      return next();
    }

    // 5. บัญชีปกติ (active)
    if (status === 'active') {
      return next();
    }

    return next(new AppError(403, 'FORBIDDEN', 'สถานะบัญชีไม่สามารถดำเนินการนี้ได้'));
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireActiveAccount,
  hashToken,
};

