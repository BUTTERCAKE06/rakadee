// โหลดค่าจาก .env ที่ root ของ backend แล้วรวมไว้ที่เดียว
// ห้ามอ่าน process.env ตรงจากไฟล์อื่น ให้ import จากไฟล์นี้แทน
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rakadee',
  },
  upload: {
    dir: path.join(__dirname, '..', '..', 'storage'),
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_MB) || 5,
  },
};

module.exports = config;
