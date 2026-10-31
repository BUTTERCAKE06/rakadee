// รูปแบบ response เดียวกันทั้งระบบ
// สำเร็จ: { success: true, data: ... }
// ผิดพลาด: { success: false, error: { code, message, details? } } (ส่งจาก errorHandler)
function ok(res, data = null, status = 200) {
  return res.status(status).json({ success: true, data });
}

function created(res, data = null) {
  return ok(res, data, 201);
}

// ห่อ async route handler ให้ส่ง error เข้า errorHandler อัตโนมัติ
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ok, created, asyncHandler };
