// อ่าน page/limit จาก query ตาม D-11: page เริ่ม 1, limit ค่าเริ่มต้น 20 สูงสุด 50
function pagination(query, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit };
}

module.exports = pagination;
