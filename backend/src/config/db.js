// MySQL connection pool ใช้ร่วมกันทั้งระบบ
// งานที่เกี่ยวกับเงินหรือการบิดต้องใช้ withTransaction() เสมอ
const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
  timezone: 'Z',
});

// ใช้แบบนี้:
// await withTransaction(async (conn) => {
//   const [rows] = await conn.query('SELECT ... FOR UPDATE', [id]);
//   await conn.query('UPDATE ...', [...]);
// });
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, withTransaction, ping };
