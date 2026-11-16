// รายการแจ้งเตือนของผู้ใช้ (เจ้าของ: PM) — api-spec 11.1–11.4
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { TEMPLATES } = require('./notificationTemplates');

const GROUPS = ['auction', 'finance', 'shipping'];
const eventsOf = (group) => Object.keys(TEMPLATES).filter((e) => TEMPLATES[e].group === group);

function format(row) {
  return {
    id: row.id,
    event: row.event,
    group: (TEMPLATES[row.event] && TEMPLATES[row.event].group) || null,
    title: row.title,
    message: row.message,
    linkUrl: row.link_url,
    isRead: !!row.read_at,
    createdAt: row.created_at,
  };
}

async function unreadCount(userId) {
  const [[row]] = await db.pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return row.n;
}

// 11.1 GET /api/notifications?unread=true&group=auction&page=&limit=
async function list(userId, { unread, group, page, limit }) {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unread === 'true') where.push('read_at IS NULL');
  if (group) {
    if (!GROUPS.includes(group)) throw new AppError(400, 'VALIDATION_ERROR', 'กลุ่มแจ้งเตือนไม่ถูกต้อง', { group: 'ต้องเป็น auction, finance หรือ shipping' });
    where.push('event IN (?)');
    params.push(eventsOf(group));
  }
  const whereSql = where.join(' AND ');
  const [[{ total }]] = await db.pool.query(`SELECT COUNT(*) AS total FROM notifications WHERE ${whereSql}`, params);
  const [rows] = await db.pool.query(
    `SELECT * FROM notifications WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  return { items: rows.map(format), page, limit, total, unreadCount: await unreadCount(userId) };
}

// 11.3 POST /api/notifications/:id/read
async function markRead(userId, id) {
  const [result] = await db.pool.query(
    'UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!result.affectedRows) throw new AppError(404, 'NOT_FOUND', 'ไม่พบการแจ้งเตือนนี้');
  return { id, isRead: true, unreadCount: await unreadCount(userId) };
}

// 11.4 POST /api/notifications/read-all
async function markAllRead(userId) {
  const [result] = await db.pool.query(
    'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  return { updated: result.affectedRows, unreadCount: 0 };
}

module.exports = { list, unreadCount, markRead, markAllRead };
