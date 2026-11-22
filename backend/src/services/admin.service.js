// Admin Dashboard + Audit Log (เจ้าของ: PM) — api-spec 11.5–11.7, requirement 8.2-1, 8.2-6
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
  const [[sellers]] = await db.pool.query("SELECT COUNT(*) AS pending FROM seller_profiles WHERE status = 'pending'");

  return {
    users: {
      total: Number(users.total || 0),
      newToday: Number(users.newToday || 0),
      pendingVerification: Number(users.pendingVerification || 0),
      restricted: Number(users.restricted || 0),
    },
    sellers: { pendingReview: Number(sellers.pending || 0) }, // D-18
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

// ---------------------------------------------------------------- 11.6 GET /admin/dashboard/charts
const RANGES = { '7d': 7, '30d': 30, '90d': 90 };
const ORDER_STATUSES = ['pending_payment', 'awaiting_shipment', 'shipped', 'completed', 'disputed', 'cancelled'];
const DAY_MS = 24 * 60 * 60 * 1000;

// วันที่ตามเวลาไทยของคอลัมน์ DATETIME (UTC) · week = วันจันทร์ของสัปดาห์นั้น (col เป็นชื่อคอลัมน์คงที่ ไม่ใช่ค่าจากผู้ใช้)
function bucketSql(col, group) {
  const d = `DATE(${col} + INTERVAL 7 HOUR)`;
  return group === 'week' ? `DATE_SUB(${d}, INTERVAL WEEKDAY(${d}) DAY)` : d;
}

const ymd = (date) => date.toISOString().slice(0, 10);

// ป้ายแกน X ครบทุกช่วง (วันที่ไม่มีข้อมูลเป็น 0) เป็นวันที่ตามเวลาไทย YYYY-MM-DD
function buildLabels(days, group, now) {
  const todayLocal = new Date(startOfTodayBangkok(now).getTime() + BANGKOK_OFFSET_MS);
  const first = new Date(todayLocal.getTime() - (days - 1) * DAY_MS);
  if (group === 'week') first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const step = group === 'week' ? 7 : 1;
  const labels = [];
  for (let d = first; d <= todayLocal; d = new Date(d.getTime() + step * DAY_MS)) labels.push(ymd(d));
  return labels;
}

const dateKey = (v) => (v instanceof Date ? ymd(v) : String(v).slice(0, 10));

function series(labels, rows, field) {
  const map = new Map(rows.map((r) => [dateKey(r.bucket), Number(r[field] || 0)]));
  return labels.map((l) => map.get(l) || 0);
}

async function getCharts({ range = '30d', group = 'day' } = {}, now = new Date()) {
  const days = RANGES[range];
  if (!days) throw new AppError(400, 'VALIDATION_ERROR', 'ช่วงเวลาไม่ถูกต้อง', { range: 'ใช้ 7d, 30d หรือ 90d' });
  if (!['day', 'week'].includes(group)) throw new AppError(400, 'VALIDATION_ERROR', 'การจัดกลุ่มไม่ถูกต้อง', { group: 'ใช้ day หรือ week' });

  const labels = buildLabels(days, group, now);
  const since = new Date(new Date(`${labels[0]}T00:00:00.000Z`).getTime() - BANGKOK_OFFSET_MS);

  // ปิดการขายสำเร็จ = Order ที่เกิดขึ้น (ชนะประมูล + ซื้อทันที) ไม่นับที่ถูกยกเลิก
  const [sales] = await db.pool.query(
    `SELECT ${bucketSql('created_at', group)} AS bucket, COUNT(*) AS n, SUM(item_price) AS v
       FROM orders WHERE created_at >= ? AND status <> 'cancelled' GROUP BY bucket`,
    [since],
  );
  // GMV = ยอดที่แอดมินอนุมัติการชำระ (นิยามเดียวกับ gmvToday ใน 11.5)
  const [gmv] = await db.pool.query(
    `SELECT ${bucketSql('paid_at', group)} AS bucket, SUM(total_amount) AS v
       FROM orders WHERE paid_at >= ? GROUP BY bucket`,
    [since],
  );
  const [fees] = await db.pool.query(
    `SELECT ${bucketSql('released_at', group)} AS bucket, SUM(fee_amount) AS v
       FROM escrows WHERE status = 'released' AND released_at >= ? GROUP BY bucket`,
    [since],
  );
  // ยอดขายตามหมวดหลักในช่วงเวลาเดียวกัน
  const [byCategory] = await db.pool.query(
    `SELECT COALESCE(pc.name, c.name) AS name, COUNT(*) AS n, SUM(o.item_price) AS v
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN categories c ON c.id = l.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE o.created_at >= ? AND o.status <> 'cancelled'
      GROUP BY COALESCE(pc.name, c.name)
      ORDER BY v DESC`,
    [since],
  );
  // สถานะคำสั่งซื้อทั้งหมด ณ ตอนนี้ (ไม่ขึ้นกับช่วงเวลา)
  const [statusRows] = await db.pool.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const statusMap = new Map(statusRows.map((r) => [r.status, Number(r.n)]));

  return {
    range,
    group,
    labels,
    completedAuctions: series(labels, sales, 'n'),
    salesValue: series(labels, sales, 'v'),
    gmv: series(labels, gmv, 'v'),
    fees: series(labels, fees, 'v'),
    byCategory: byCategory.map((r) => ({ name: r.name, count: Number(r.n), value: Number(r.v || 0) })),
    orderStatus: ORDER_STATUSES.map((status) => ({ status, count: statusMap.get(status) || 0 })),
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------- 11.7 GET /admin/audit-logs
const AUDIT_SORTS = {
  newest: 'l.created_at DESC, l.id DESC',
  oldest: 'l.created_at ASC, l.id ASC',
  admin: 'u.display_name ASC, l.created_at DESC',
  action: 'l.action ASC, l.created_at DESC',
};

// Admin เห็นเฉพาะของตัวเอง Super Admin เห็นทั้งหมดและกรองตาม adminId ได้ (requirement 8.1)
async function listAuditLogs(viewer, { adminId, action, targetType, from, to, sort = 'newest', page, limit }) {
  if (!AUDIT_SORTS[sort]) {
    throw new AppError(400, 'VALIDATION_ERROR', 'การเรียงลำดับไม่ถูกต้อง', { sort: 'ใช้ newest, oldest, admin หรือ action' });
  }
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
      ORDER BY ${AUDIT_SORTS[sort]}
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

module.exports = { getDashboard, getCharts, listAuditLogs, startOfTodayBangkok, buildLabels };
