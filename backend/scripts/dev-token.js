// ออก session token ให้บัญชีในฐานข้อมูล ใช้ทดสอบ API ระหว่างที่ยังไม่มีหน้า login (ใช้ในเครื่องตัวเองเท่านั้น)
// ใช้: npm run dev:token -- buyer1
// แล้วนำ token ไปใช้:
//   - Postman / curl: header  Authorization: Bearer <token>
//   - หน้าเว็บ: เปิด DevTools > Console แล้วพิมพ์  localStorage.setItem('rakadee_token', '<token>')
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  if (config.env === 'production') throw new Error('dev:token ใช้ใน production ไม่ได้');
  const username = process.argv[2];
  if (!username) throw new Error('ระบุ username เช่น npm run dev:token -- buyer1');

  const conn = await mysql.createConnection(config.db);
  try {
    await conn.query("SET time_zone = '+00:00'");
    const [rows] = await conn.query('SELECT id, role, status FROM users WHERE username = ?', [username]);
    if (!rows.length) throw new Error(`ไม่พบผู้ใช้ ${username}`);
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await conn.query(
      `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, '127.0.0.1', 'dev-token script', UTC_TIMESTAMP() + INTERVAL ? HOUR)`,
      [rows[0].id, hash, config.security.sessionTtlHours],
    );
    console.log(`user:  ${username} (id ${rows[0].id}, ${rows[0].role}, ${rows[0].status})`);
    console.log(`token: ${token}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
