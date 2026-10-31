# API Spec (เจ้าของ: SA)

SA วางไฟล์ในโฟลเดอร์นี้:

- `openapi.yaml` รายการ API ทั้งระบบในรูปแบบ OpenAPI 3 **ไฟล์หลักที่ AI และทุกคนอ้างอิง**
- (ถ้าใช้) Postman collection export เป็น `rakadee.postman_collection.json`

กติกา:

- ทุก path ขึ้นต้นด้วย `/api` ชื่อ resource เป็นพหูพจน์ `kebab-case` เช่น `/api/listings/{id}/bids`
- body และ response ใช้ `camelCase`
- response สำเร็จ: `{ "success": true, "data": ... }`
- response ผิดพลาด: `{ "success": false, "error": { "code": "BID_TOO_LOW", "message": "..." } }`
- error code ใช้ `UPPER_SNAKE_CASE` และต้องระบุไว้ใน spec ของแต่ละ endpoint
- ระบุ role ที่เรียกได้ทุก endpoint: guest, bidder, seller, admin, super_admin
- หัวข้อโมดูล (tag): auth, users, wallet, payments, listings, bids, orders, shipments, disputes, notifications, admin
