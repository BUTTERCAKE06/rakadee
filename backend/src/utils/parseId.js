// parseId.js — แปลง URL param เป็น integer บวก
// ถ้าว่าง, ไม่ใช่เลข หรือ <= 0 → throw AppError 400
// ใช้ใน controller: const id = parseId(req.params.id, 'id');
const AppError = require('./AppError');

function parseId(raw, name = 'id') {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${name} ต้องเป็นเลขจำนวนเต็มบวก`, {
      [name]: 'ต้องเป็นเลขจำนวนเต็มบวก',
    });
  }
  return n;
}

module.exports = parseId;
