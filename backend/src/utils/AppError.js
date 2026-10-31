// โยน error ที่ตั้งใจให้ผู้ใช้เห็น
// throw new AppError(400, 'BID_TOO_LOW', 'ราคาต้องไม่ต่ำกว่า 1,500 บาท');
// code ใช้ตัวพิมพ์ใหญ่และ _ ตามที่กำหนดใน API Spec
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
