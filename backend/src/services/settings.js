// ตั้งค่าระบบ (เจ้าของ: PM) — api-spec 11.8, 11.9, requirement 8.1 (Super Admin)
// ค่าเก็บในตาราง system_settings อ่านผ่านไฟล์นี้เท่านั้น ห้าม hard-code ค่าที่ตั้งได้
//   settings.get('platform_fee_percent')  → '5'
//   settings.feeConfig()                  → { percent: 5, min: 20 }  ใช้กับ escrow.calculatePlatformFee
//   settings.initialCredit()              → 10000
// อ่านจาก cache สั้นๆ (ลด query) แก้ค่าแล้วล้าง cache ทันที
const db = require('../config/db');
const AppError = require('../utils/AppError');
const audit = require('./audit');

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
const VERSION = /^\d{1,3}(\.\d{1,3}){0,2}$/;

// ค่าที่แก้ได้ + กติกาตรวจ + ค่าเริ่มต้นเมื่อไม่มีในตาราง (ตาม requirement 5.4, D-05)
const RULES = {
  platform_fee_percent: { label: 'ค่าธรรมเนียม (%)', fallback: '5', check: (v) => MONEY.test(v) && Number(v) <= 100, hint: 'ตัวเลข 0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง' },
  platform_fee_min: { label: 'ค่าธรรมเนียมขั้นต่ำ (บาท)', fallback: '20', check: (v) => MONEY.test(v) && Number(v) <= 100000, hint: 'ตัวเลข 0–100,000 ทศนิยมไม่เกิน 2 ตำแหน่ง' },
  initial_wallet_credit: { label: 'เครดิตแรกเข้า (บาท)', fallback: '10000', check: (v) => MONEY.test(v) && Number(v) <= 1000000, hint: 'ตัวเลข 0–1,000,000 ทศนิยมไม่เกิน 2 ตำแหน่ง' },
  terms_version: { label: 'เวอร์ชันข้อกำหนดการใช้งาน', fallback: '1.0', check: (v) => VERSION.test(v), hint: 'รูปแบบเลขเวอร์ชัน เช่น 1.0 หรือ 1.2.1' },
  privacy_version: { label: 'เวอร์ชันนโยบายความเป็นส่วนตัว', fallback: '1.0', check: (v) => VERSION.test(v), hint: 'รูปแบบเลขเวอร์ชัน เช่น 1.0 หรือ 1.2.1' },
};
const KEYS = Object.keys(RULES);
const CACHE_MS = 10 * 1000;
let cache = null;

async function loadAll() {
  if (cache && cache.at > Date.now() - CACHE_MS) return cache.values;
  const [rows] = await db.pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?)', [KEYS]);
  const values = Object.fromEntries(KEYS.map((k) => [k, RULES[k].fallback]));
  rows.forEach((r) => { values[r.setting_key] = r.setting_value; });
  cache = { at: Date.now(), values };
  return values;
}

async function get(key) {
  if (!RULES[key]) throw new Error(`Unknown setting: ${key}`);
  return (await loadAll())[key];
}

async function feeConfig() {
  const v = await loadAll();
  return { percent: Number(v.platform_fee_percent), min: Number(v.platform_fee_min) };
}

async function initialCredit() {
  return Number(await get('initial_wallet_credit'));
}

// ---------------------------------------------------------------- 11.8 GET /admin/settings
async function list() {
  const values = await loadAll();
  const [rows] = await db.pool.query(
    `SELECT s.setting_key, s.description, s.updated_at, u.id AS updater_id, u.display_name AS updater_name
       FROM system_settings s LEFT JOIN users u ON u.id = s.updated_by
      WHERE s.setting_key IN (?)`,
    [KEYS],
  );
  const meta = new Map(rows.map((r) => [r.setting_key, r]));
  return {
    settings: values,
    items: KEYS.map((key) => {
      const m = meta.get(key) || {};
      return {
        key,
        value: values[key],
        label: RULES[key].label,
        description: m.description || null,
        hint: RULES[key].hint,
        updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : null,
        updatedBy: m.updater_id ? { id: Number(m.updater_id), displayName: m.updater_name } : null,
      };
    }),
  };
}

// ---------------------------------------------------------------- 11.9 PUT /admin/settings
async function update(admin, input, ip) {
  const incoming = input && typeof input === 'object' ? input : {};
  const errors = {};
  const next = {};
  Object.entries(incoming).forEach(([key, raw]) => {
    if (!RULES[key]) { errors[key] = 'ไม่มีค่าตั้งนี้ในระบบ'; return; }
    const value = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!RULES[key].check(value)) { errors[key] = RULES[key].hint; return; }
    next[key] = value;
  });
  if (!Object.keys(incoming).length) errors.settings = 'ไม่มีค่าที่ต้องการแก้ไข';
  if (Object.keys(errors).length) throw new AppError(400, 'INVALID_SETTING', 'ค่าตั้งไม่ถูกต้อง', errors);

  const before = await loadAll();
  const changes = {};
  await db.withTransaction(async (conn) => {
    for (const [key, value] of Object.entries(next)) {
      if (before[key] === value) continue;
      await conn.query(
        `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [key, value, admin.id],
      );
      changes[key] = { from: before[key], to: value };
    }
  });
  cache = null;
  if (Object.keys(changes).length) {
    await audit.log(admin.id, 'SETTING_UPDATE', 'setting', 'system', ip, { changes });
  }
  return { ...(await list()), changed: Object.keys(changes) };
}

module.exports = { get, feeConfig, initialCredit, list, update, KEYS };
