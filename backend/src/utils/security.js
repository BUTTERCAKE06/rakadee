// Security & Cryptographic Helpers D-12 ใน docs/decision-log.md
const crypto = require('crypto');
const config = require('../config');

// คีย์เข้ารหัส AES-256 (32 bytes hex) และ HMAC (32 bytes hex)
const DEFAULT_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ENC_KEY_HEX = config.security.idCardEncKey || DEFAULT_KEY_HEX;
const HASH_KEY_HEX = config.security.idCardHashKey || DEFAULT_KEY_HEX;

/**
 * ตรวจสอบความถูกต้องของเลขประจำตัวประชาชนไทย 13 หลัก ด้วยChecksum 
 * @param {string} id
 * @returns {boolean}
 */
function validateThaiIdCard(id) {
  if (typeof id !== 'string' || !/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i), 10) * (14 - (i + 1));
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(id.charAt(12), 10);
}

/**
 * คำนวณ HMAC-SHA256 ของเลขบัตรประชาชน สำหรับใช้ค้นหาความซ้ำซ้อนและ Blacklist (D-12)
 * @param {string} idCardNumber
 * @returns {string} 64-char hex string
 */
function hashIdCard(idCardNumber) {
  const key = Buffer.from(HASH_KEY_HEX.padEnd(64, '0').slice(0, 64), 'hex');
  return crypto.createHmac('sha256', key).update(String(idCardNumber).trim()).digest('hex');
}

/**
 * เข้ารหัสเลขบัตรประชาชนด้วย AES-256-GCM สำหรับเก็บลง users.id_card_encrypted
 * บรรจุ IV (12 bytes) + AuthTag (16 bytes) + Ciphertext รวมไว้ใน Buffer เดียว
 * @param {string} idCardNumber
 * @returns {Buffer}
 */
function encryptIdCard(idCardNumber) {
  const key = Buffer.from(ENC_KEY_HEX.padEnd(64, '0').slice(0, 64), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(idCardNumber).trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * ถอดรหัสเลขบัตรประชาชนจาก Buffer ของ AES-256-GCM
 * @param {Buffer} buffer
 * @returns {string|null}
 */
function decryptIdCard(buffer) {
  if (!buffer || buffer.length < 28) return null;
  try {
    const key = Buffer.from(ENC_KEY_HEX.padEnd(64, '0').slice(0, 64), 'hex');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * คำนวณ SHA-256 สำหรับโทเค็นหรือรหัส OTP
 * @param {string} text
 * @returns {string} 64-char hex string
 */
function hashSha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

/**
 * สุ่มรหัส OTP ตัวเลข 6 หลัก
 * @returns {string}
 */
function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * สุ่ม Session Token หรือ Token สำหรับรีเซ็ตรหัสผ่าน/ยืนยันอีเมล
 * @param {number} bytes
 * @returns {string}
 */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  validateThaiIdCard,
  hashIdCard,
  encryptIdCard,
  decryptIdCard,
  hashSha256,
  generateOtpCode,
  generateRandomToken,
};

