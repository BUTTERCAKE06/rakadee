// เรียก API ทุกครั้งผ่านไฟล์นี้ ห้ามใช้ fetch ตรงในหน้าอื่น
// ใช้แบบนี้:
//   const data = await api.get('/listings?sort=ending');
//   const bid = await api.post(`/listings/${id}/bids`, { amount: 1500 });
//   const res = await api.upload('/listings/1/images', formData);
// ถ้า API ตอบ success:false จะ throw ApiError ที่มี code และ message ให้นำไปแสดงผล
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const api = (() => {
  const BASE = '/api';
  const TOKEN_KEY = 'rakadee_token';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  function setToken(token) {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }

  async function request(method, path, body, isForm = false) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }

    let json = null;
    try { json = await res.json(); } catch { /* not json */ }

    if (!res.ok || !json || json.success === false) {
      const err = (json && json.error) || {};
      if (res.status === 401) setToken(null);
      throw new ApiError(res.status, err.code || 'UNKNOWN_ERROR', err.message || 'เกิดข้อผิดพลาด', err.details);
    }
    return json.data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    upload: (path, formData) => request('POST', path, formData, true),
    getToken,
    setToken,
  };
})();
