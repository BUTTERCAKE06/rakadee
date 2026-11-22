// Notification Service (เจ้าของ: PM) — requirement ข้อ 7 การแจ้งเตือน, api-spec หัวข้อ 11
// notify(userId, event, data) ทำ 3 อย่างตามการตั้งค่าของผู้ใช้ (notification_settings):
//   1. บันทึกลงตาราง notifications (แจ้งเตือนในเว็บ)
//   2. push ผ่าน Socket.IO ไปที่ห้อง user:<id> (event 'notification:new')
//   3. ส่งอีเมลผ่าน SMTP (ไม่ตั้ง SMTP_HOST ใน .env = แสดงอีเมลใน console แทน)
// เรียกหลัง COMMIT เท่านั้น และ notify จะไม่ throw ถ้าส่งไม่สำเร็จ (log ไว้แทน) เพื่อไม่ให้งานหลักล้ม
// ยกเว้นส่ง event ที่ไม่มีอยู่จริง จะ throw ทันทีเพื่อให้เห็นตั้งแต่ตอนพัฒนา
const db = require('../config/db');
const { emitToUser } = require('../socket');
const mailer = require('./mailer');
const { TEMPLATES } = require('./notificationTemplates');

const EVENTS = Object.freeze(Object.fromEntries(Object.keys(TEMPLATES).map((k) => [k, k])));

const REFERENCE_KEYS = [
  ['disputeId', 'dispute'],
  ['orderId', 'order'],
  ['paymentId', 'payment'],
  ['listingId', 'listing'],
];

async function enrich(data) {
  const d = { ...data };
  if (!d.listingTitle && (d.listingId || d.orderId)) {
    const [rows] = d.listingId
      ? await db.pool.query('SELECT id, title FROM listings WHERE id = ?', [d.listingId])
      : await db.pool.query('SELECT l.id, l.title FROM orders o JOIN listings l ON l.id = o.listing_id WHERE o.id = ?', [d.orderId]);
    if (rows.length) {
      d.listingTitle = rows[0].title;
      d.listingId = d.listingId || rows[0].id;
    }
  }
  return d;
}

async function loadChannels(userId, group) {
  if (!group) return { web: true, email: true };
  const [rows] = await db.pool.query('SELECT * FROM notification_settings WHERE user_id = ?', [userId]);
  if (!rows.length) return { web: true, email: true };
  return { web: !!rows[0][`${group}_web`], email: !!rows[0][`${group}_email`] };
}

/**
 * @param {number} userId ผู้รับ
 * @param {string} event หนึ่งใน EVENTS
 * @param {object} data ข้อมูลประกอบ เช่น { listingId, orderId, amount } (ดู notificationTemplates.js)
 * @returns {Promise<object|null>} แจ้งเตือนที่บันทึก หรือ null ถ้าไม่ได้บันทึกในเว็บ
 */
async function notify(userId, event, data = {}) {
  const tpl = TEMPLATES[event];
  if (!tpl) throw new Error(`Unknown notification event: ${event}`);

  try {
    const d = await enrich(data);
    const channels = await loadChannels(userId, tpl.group);
    const title = d.title || tpl.title(d);
    const message = d.message || tpl.message(d);
    const linkUrl = d.linkUrl || tpl.link(d);
    const [refKey, refType] = REFERENCE_KEYS.find(([k]) => d[k]) || [];

    let saved = null;
    if (tpl.web !== false && channels.web) {
      const [result] = await db.pool.query(
        `INSERT INTO notifications (user_id, event, title, message, link_url, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, event, title, message.slice(0, 500), linkUrl, refType || null, refKey ? d[refKey] : null],
      );
      saved = { id: result.insertId, event, title, message, linkUrl, isRead: false, createdAt: new Date().toISOString() };
      emitToUser(userId, 'notification:new', saved);
    }

    if (tpl.email !== false && channels.email) {
      const [users] = await db.pool.query('SELECT email FROM users WHERE id = ?', [userId]);
      if (users.length) {
        await mailer.send(users[0].email, title, message, linkUrl);
        if (saved) await db.pool.query('UPDATE notifications SET emailed_at = UTC_TIMESTAMP() WHERE id = ?', [saved.id]);
      }
    }
    return saved;
  } catch (err) {
    console.error(`[notify] user=${userId} event=${event} failed:`, err.message);
    return null;
  }
}

module.exports = { notify, EVENTS };
