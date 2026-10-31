# ERD (เจ้าของ: SA)

SA วางไฟล์ในโฟลเดอร์นี้:

- `schema.sql` โครงสร้างตารางทั้งระบบ (CREATE TABLE) **ไฟล์หลักที่ AI และทุกคนอ้างอิง**
- `erd.png` หรือ `erd.pdf` รูปแผนผังสำหรับส่งอาจารย์

กติกา:

- ชื่อตารางและคอลัมน์ใช้ `snake_case` ชื่อตารางเป็นพหูพจน์ เช่น `users`, `listings`, `bids`
- ทุกตารางมี `id` (BIGINT AUTO_INCREMENT), `created_at`, `updated_at`
- เวลาเก็บเป็น UTC (`DATETIME`) เงินเก็บเป็น `DECIMAL(12,2)` ห้ามใช้ FLOAT
- สถานะเก็บเป็นค่าภาษาอังกฤษตัวเล็ก เช่น `pending_verification` ส่วนชื่อภาษาไทยแปลงที่ฝั่ง FE
- สถานะบัญชีต้องตรงกับ D-03 ใน `docs/decision-log.md`

ตารางที่อย่างน้อยต้องมี (จากแผนงานรายเฟส): users, user_consents, otp_codes, password_resets, sessions, addresses, seller_profiles, categories, listings, listing_images, bids, proxy_bids, watchlists, orders, payments, wallets, wallet_transactions, escrows, shipments, disputes, dispute_evidence, penalties, blacklists, notifications, notification_settings, admin_audit_logs, system_settings
