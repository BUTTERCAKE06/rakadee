// Auth middleware (เจ้าของ: SA) — api-spec หัวข้อ 0.2–0.3, D-03, D-07, D-12
// ฉบับนี้ PM ทำไว้ก่อนเพื่อให้ทีมทดสอบได้ ลายเซ็นของทั้ง 3 ฟังก์ชันคงที่ตาม AGENTS.md
// SA แก้ภายในได้ (เช่น อัปเดต last_seen_at) แต่ห้ามเปลี่ยนชื่อ พารามิเตอร์ หรือรูปแบบ req.user
//
// ใช้แบบนี้:
//   router.get('/x', requireAuth, requireRole('member'), requireActiveAccount('bid'), handler)
// req.user = { id, username, displayName, email, role, status, statusUntil, sessionId }
const crypto = require('crypto');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// หา user จาก token ที่ยังไม่หมดอายุและไม่ถูก revoke ใช้ร่วมกับ Socket.IO
async function findUserByToken(token) {
  if (!token) return null;
  const [rows] = await db.pool.query(
    `SELECT u.id, u.username, u.display_name, u.email, u.role, u.status, u.status_until, s.id AS session_id
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
    [hashToken(token)],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    email: r.email,
    role: r.role,
    status: r.status,
    statusUntil: r.status_until,
    sessionId: r.session_id,
  };
}

async function requireAuth(req, res, next) {
  try {
    const user = await findUserByToken(readToken(req));
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
    if (user.status === 'banned') throw new AppError(403, 'ACCOUNT_BANNED', 'บัญชีนี้ถูกระงับถาวร');
    req.user = user;
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

function requireRole(...groups) {
  const allowed = new Set(groups.flatMap((g) => ROLE_GROUPS[g] || [g]));
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ'));
    if (!allowed.has(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
    next();
  };
}

// ตารางสิทธิ์ตามสถานะบัญชี (api-spec 0.3) ค่า true = ทำได้
const STATUS_RULES = {
  bid: { active: true, restricted: true },
  sell: { active: true },
  pay: { active: true, restricted: true, suspended: true },
};

const STATUS_ERRORS = {
  pending_verification: ['ACCOUNT_NOT_VERIFIED', 'กรุณายืนยันเบอร์โทรศัพท์ก่อนใช้งาน'],
  restricted: ['ACCOUNT_RESTRICTED', 'บัญชีของคุณถูกจำกัดสิทธิ์การลงสินค้า'],
  suspended: ['ACCOUNT_SUSPENDED', 'บัญชีของคุณถูกระงับชั่วคราว'],
  banned: ['ACCOUNT_BANNED', 'บัญชีนี้ถูกระงับถาวร'],
};

function requireActiveAccount(action) {
  const rule = STATUS_RULES[action];
  if (!rule) throw new Error(`Unknown account action: ${action}`);
  return (req, res, next) => {
    const { status, statusUntil } = req.user || {};
    if (rule[status]) return next();
    const [code, message] = STATUS_ERRORS[status] || ['FORBIDDEN', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'];
    next(new AppError(403, code, message, statusUntil ? { until: statusUntil } : undefined));
  };
}

module.exports = { requireAuth, requireRole, requireActiveAccount, findUserByToken, hashToken };
