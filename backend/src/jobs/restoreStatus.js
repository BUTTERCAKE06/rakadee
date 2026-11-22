// Scheduler restoreStatus (เจ้าของ: QA) — D-03, api-spec 10
// คืนบัญชี restricted / suspended ที่ครบกำหนด (status_until <= now) เป็น active
const db = require('../config/db');

module.exports = {
  name: 'restoreStatus',
  run: async () => {
    const [res] = await db.pool.query(
      `UPDATE users
          SET status = 'active', status_until = NULL, status_reason = NULL
        WHERE status IN ('restricted', 'suspended')
          AND status_until IS NOT NULL
          AND status_until <= UTC_TIMESTAMP()`,
    );
    if (res.affectedRows) console.log(`[job:restoreStatus] restored ${res.affectedRows} account(s)`);
  },
};
