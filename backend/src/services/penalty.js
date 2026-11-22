// Penalty Service (เจ้าของ: QA) — requirement 7.1–7.3, D-03, D-04, api-spec หัวข้อ 10
// Interface กลาง (ห้ามเปลี่ยนชื่อหรือพารามิเตอร์ 3 ตัวแรก):
//   penalty.add(userId, type, { orderId, note })
//
// กติกา (api-spec 10 Service + comment ตาราง penalties ใน schema.sql):
//   non_payment   ครั้งที่ 1 → warning, ครั้งที่ 2 ขึ้นไป → suspended จนถึง now + time.suspendMs   (SA เรียกจาก paymentTimeout)
//   no_shipment   ครั้งที่ 1 → warning, ครั้งที่ 2 ขึ้นไป → restricted จนถึง now + time.suspendMs  (PM เรียกจากยกเลิก Order 8.6)
//   shill_bidding → warning (บันทึกประวัติให้แอดมิน ไม่ลงโทษอัตโนมัติ ข้อ 7.3)
//   admin_ban     → banned + ยกเลิกทุก session + เพิ่ม blacklists (id_card_hash + phone) ต้องส่ง createdBy (แอดมิน)
//
// ตัวเลือกเพิ่มเติมใน object ที่ 3 (ไม่บังคับ):
//   conn       connection ของ transaction ภายนอก (เช่น paymentTimeout ที่ล็อก order อยู่) ถ้าไม่ส่งจะเปิด transaction เอง
//   createdBy  id แอดมิน (NULL = ระบบ / Scheduler)
//
// หมายเหตุ: ยังไม่มี event แจ้งเตือนผู้ใช้เรื่องบทลงโทษใน notify.js (ดู docs/qa/README.md หัวข้อ "ปัญหาที่เจอ")
const db = require('../config/db');
const time = require('../config/time');
const AppError = require('../utils/AppError');

const TYPES = ['non_payment', 'no_shipment', 'shill_bidding', 'admin_ban'];

// ความรุนแรงของสถานะ ใช้กันไม่ให้บทลงโทษใหม่ลดระดับสถานะเดิม (เช่น suspended → restricted)
const SEVERITY = { active: 0, restricted: 1, suspended: 2, banned: 3 };

/**
 * บันทึกความผิดและเปลี่ยนสถานะบัญชีตามจำนวนครั้ง
 * @param {number} userId
 * @param {'non_payment'|'no_shipment'|'shill_bidding'|'admin_ban'} type
 * @param {{ orderId?: number, note?: string, createdBy?: number, conn?: object }} [opts]
 * @returns {Promise<{ penaltyId, type, action, actionUntil, count, status, blacklistId? }>}
 */
async function add(userId, type, opts = {}) {
  if (!TYPES.includes(type)) throw new Error(`Unknown penalty type: ${type}`);
  const { orderId = null, note = null, createdBy = null, conn } = opts;
  if (type === 'admin_ban' && !createdBy) throw new Error('penalty.add(admin_ban) ต้องส่ง createdBy');

  const run = (work) => (conn ? work(conn) : db.withTransaction(work));

  return run(async (c) => {
    const [[user]] = await c.query(
      'SELECT id, role, status, status_until, phone, id_card_hash FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้');

    // นับครั้งรวมครั้งนี้
    const [[{ cnt }]] = await c.query(
      'SELECT COUNT(*) AS cnt FROM penalties WHERE user_id = ? AND type = ?',
      [userId, type],
    );
    const count = Number(cnt) + 1;

    let action = 'warning';
    let newStatus = null;
    if (type === 'non_payment' && count >= 2) { action = 'suspend'; newStatus = 'suspended'; }
    if (type === 'no_shipment' && count >= 2) { action = 'restrict'; newStatus = 'restricted'; }
    if (type === 'admin_ban') { action = 'ban'; newStatus = 'banned'; }

    const actionUntil = (newStatus === 'suspended' || newStatus === 'restricted')
      ? new Date(Date.now() + time.suspendMs)
      : null;

    const [ins] = await c.query(
      `INSERT INTO penalties (user_id, type, order_id, action, action_until, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, orderId, action, actionUntil, note ? String(note).slice(0, 500) : null, createdBy],
    );

    let status = user.status;
    if (newStatus) {
      const current = SEVERITY[user.status] ?? 0; // pending_verification ถือเป็น 0
      if (SEVERITY[newStatus] > current) {
        status = newStatus;
        await c.query(
          'UPDATE users SET status = ?, status_until = ?, status_reason = ? WHERE id = ?',
          [newStatus, actionUntil, reasonText(type, note), userId],
        );
      } else if (SEVERITY[newStatus] === current && actionUntil) {
        // สถานะเดียวกันซ้ำ: ต่อวันหมดอายุออกไป (ไม่ลดวันเดิม)
        await c.query(
          'UPDATE users SET status_until = GREATEST(COALESCE(status_until, ?), ?) WHERE id = ?',
          [actionUntil, actionUntil, userId],
        );
      }
    }

    const result = {
      penaltyId: ins.insertId,
      type,
      action,
      actionUntil: actionUntil ? actionUntil.toISOString() : null,
      count,
      status,
    };

    if (type === 'admin_ban') {
      await c.query('UPDATE sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
      const [bl] = await c.query(
        `INSERT INTO blacklists (user_id, id_card_hash, phone, reason, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, user.id_card_hash || null, user.phone || null, String(note || 'แบนโดยแอดมิน').slice(0, 500), createdBy],
      );
      result.blacklistId = bl.insertId;
    }

    return result;
  });
}

function reasonText(type, note) {
  const base = {
    non_payment: 'ชนะประมูลแล้วไม่ชำระเงินซ้ำ',
    no_shipment: 'ไม่จัดส่งสินค้าตามกำหนดซ้ำ',
    admin_ban: 'แบนโดยแอดมิน',
  }[type] || type;
  return (note ? `${base}: ${note}` : base).slice(0, 255);
}

module.exports = { add, TYPES };
