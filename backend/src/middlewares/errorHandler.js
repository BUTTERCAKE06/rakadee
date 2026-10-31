const multer = require('multer');
const AppError = require('../utils/AppError');
const config = require('../config');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `ไม่พบ ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `ไฟล์ต้องไม่เกิน ${config.upload.maxFileSizeMb} MB`
      : 'อัปโหลดไฟล์ไม่สำเร็จ';
    err = new AppError(400, 'UPLOAD_INVALID', message);
  }

  if (!(err instanceof AppError)) {
    console.error(err);
    err = new AppError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาดในระบบ');
  }

  const error = { code: err.code, message: err.message };
  if (err.details) error.details = err.details;
  res.status(err.status).json({ success: false, error });
}

module.exports = { notFound, errorHandler };
