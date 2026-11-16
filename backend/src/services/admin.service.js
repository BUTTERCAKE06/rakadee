// Admin Dashboard + Audit Log (เจ้าของ: PM) — api-spec 11.5, 11.7, requirement 8.2-1, 8.2-6
const db = require('../config/db');
const AppError = require('../utils/AppError');

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

// เที่ยงคืนวันนี้ตามเวลาไทย แปลงกลับเป็น UTC (DB เก็บเวลาเป็น UTC)
function startOfTodayBangkok(now = new Date()) {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BANGKOK_OFFSET_MS);
}

// วันที่ YYYY-MM-DD ตามเวลาไทย → ช่วงเวลา UTC
function bangkokDate(value, field, endOfDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'รูปแบบวันที่ไม่ถูกต้อง', { [field]: 'ใช้รูปแบบ YYYY-MM-DD' });
  }
  const start = new Date(`${value}T00:00:00.000Z`).getTime() - BANGKOK_OFFSET_MS;
  return new Date(endOfDay ? start + 24 * 60 * 60 * 1000 : start);
}

const money = (v) => Number(v || 0);

// ---------------------------------------------------------------- 11.5 GET /admin/dashboard
async function getDashboard() {
  const today = startOfTodayBangkok();
  const [[users]] = await db.pool.query(
    `SELECT COUNT(*) AS total,
            SUM(created_at >= ?) AS newToday,
            SUM(status = 'pending_verification') AS pendingVerification,
            SUM(status IN ('restricted', 'suspended')) AS restricted
       FROM users WHERE role IN ('bidder', 'seller')`,
    [today],
  );
  const [[listings]] = await db.pool.query(
    `SELECT SUM(status = 'active') AS active,
            SUM(status = 'pending_review') AS pendingReview,
            SUM(status = 'active' AND end_at <= UTC_TIMESTAMP() + INTERVAL 1 HOUR) AS endingWithinHour
       FROM listings`,
  );
  const [[orders]] = await db.pool.query(
    `SELECT SUM(o.status = 'pending_payment' AND NOT EXISTS
               (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'pending_review')) AS pendingPayment,
            SUM(o.status = 'awaiting_shipment') AS awaitingShipment,
            SUM(o.status = 'shipped') AS shipped,
            SUM(o.status = 'completed' AND o.completed_at >= ?) AS completedToday,
            COALESCE(SUM(CASE WHEN o.paid_at >= ? THEN o.total_amount END), 0) AS gmvToday
       FROM orders o`,
    [today, today],
  );
  const [[payments]] = await db.pool.query("SELECT COUNT(*) AS review FROM payments WHERE status = 'pending_review'");
  const [[escrow]] = await db.pool.query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'held' THEN amount END), 0) AS held,
            COALESCE(SUM(CASE WHEN status = 'released' THEN fee_amount END), 0) AS fees
       FROM escrows`,
  );
  const [[disputes]] = await db.pool.query("SELECT COUNT(*) AS open FROM disputes WHERE status <> 'closed'");

  return {
    users: {
      total: Number(users.total || 0),
      newToday: Number(users.newToday || 0),
      pendingVerification: Number(users.pendingVerification || 0),
      restricted: Number(users.restricted || 0),
    },
    listings: {
      active: Number(listings.active || 0),
      pendingReview: Number(listings.pendingReview || 0),
      endingWithinHour: Number(listings.endingWithinHour || 0),
    },
    orders: {
      pendingPayment: Number(orders.pendingPayment || 0),
      paymentReview: Number(payments.review || 0),
      awaitingShipment: Number(orders.awaitingShipment || 0),
      shipped: Number(orders.shipped || 0),
      completedToday: Number(orders.completedToday || 0),
    },
    money: {
      escrowHeld: money(escrow.held),
      feesCollected: money(escrow.fees),
      gmvToday: money(orders.gmvToday),
    },
    disputes: { open: Number(disputes.open || 0) },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- 11.7 GET /admin/audit-logs
// Admin เห็นเฉพาะของตัวเอง Super Admin เห็นทั้งหมดและกรองตาม adminId ได้ (requirement 8.1)
async function listAuditLogs(viewer, { adminId, action, targetType, from, to, page, limit }) {
  const where = [];
  const params = [];
  if (viewer.role !== 'super_admin') {
    where.push('l.admin_id = ?');
    params.push(viewer.id);
  } else if (adminId) {
    where.push('l.admin_id = ?');
    params.push(Number(adminId));
  }
  if (action) {
    where.push('l.action = ?');
    params.push(String(action));
  }
  if (targetType) {
    where.push('l.target_type = ?');
    params.push(String(targetType));
  }
  if (from) {
    where.push('l.created_at >= ?');
    params.push(bangkokDate(from, 'from', false));
  }
  if (to) {
    where.push('l.created_at < ?');
    params.push(bangkokDate(to, 'to', true));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.pool.query(`SELECT COUNT(*) AS total FROM admin_audit_logs l ${whereSql}`, params);
  const [rows] = await db.pool.query(
    `SELECT l.*, u.display_name, u.username
       FROM admin_audit_logs l JOIN users u ON u.id = l.admin_id
       ${whereSql}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  const [actions] = await db.pool.query(
    `SELECT DISTINCT action FROM admin_audit_logs ${viewer.role !== 'super_admin' ? 'WHERE admin_id = ?' : ''} ORDER BY action`,
    viewer.role !== 'super_admin' ? [viewer.id] : [],
  );
  let admins = [];
  if (viewer.role === 'super_admin') {
    [admins] = await db.pool.query(
      "SELECT id, display_name AS displayName FROM users WHERE role IN ('admin', 'super_admin') ORDER BY id",
    );
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      admin: { id: r.admin_id, displayName: r.display_name || r.username },
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    })),
    page,
    limit,
    total,
    filters: { actions: actions.map((a) => a.action), admins },
  };
}

module.exports = { getDashboard, listAuditLogs, startOfTodayBangkok };
