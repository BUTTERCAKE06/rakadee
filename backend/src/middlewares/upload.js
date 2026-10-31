// อัปโหลดไฟล์ลง backend/storage/<folder>/
// ใช้แบบนี้: router.post('/', upload('products').array('images', 8), handler)
// folder ที่ใช้: products, slips, evidence, avatars
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const AppError = require('../utils/AppError');

const ALLOWED_FOLDERS = ['products', 'slips', 'evidence', 'avatars'];
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png' };

function upload(folder) {
  if (!ALLOWED_FOLDERS.includes(folder)) throw new Error(`Unknown upload folder: ${folder}`);
  const dir = path.join(config.upload.dir, folder);
  fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED_TYPES[file.mimetype]),
    }),
    limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
      cb(new AppError(400, 'UPLOAD_INVALID_TYPE', 'รองรับเฉพาะไฟล์ .jpg, .jpeg และ .png'));
    },
  });
}

module.exports = upload;
