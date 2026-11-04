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


## Sequence Diagram

### 1. โครงสร้างระบบ (Actors & Components)
1. **`User`** (ฝั่งผู้ใช้: ผู้ซื้อ/ผู้ขาย)
2. **`Admin`** (ฝั่งแอดมิน)
3. **`API Server`** (หลังบ้าน / Backend Controller)
4. **`Worker`** (ระบบรันอัตโนมัติเบื้องหลัง เช่น เช็คเวลาหมดประมูล)
5. **`Database`** (ฐานข้อมูลหลักของระบบ)

### 2. ลำดับขั้นตอนการทำงานของระบบ (Sequence Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant Admin as Admin Dashboard
    participant API as API Server
    participant Worker as Worker (Cron Job)
    participant DB as Database (31 Tables)

    Note over User, DB: เฟสที่ 0: ระบบยืนยันตัวตนและการเปิดร้านค้า (KYC & Seller Verification)
    User->>API: POST /users/kyc/submit (ส่งเลขบัตรและรูปถ่าย)
    API->>DB: INSERT INTO kyc_verifications (status = 'pending')
    Admin->>API: PATCH /admin/kyc/:id/review (อนุมัติ KYC)
    API->>DB: UPDATE kyc_verifications (approved), users (active), wallets (+10,000 THB)
    User->>API: POST /seller-profiles (ลงทะเบียนเปิดร้านค้า)
    API->>DB: INSERT INTO seller_profiles (status = 'pending')
    Admin->>API: PATCH /admin/seller-profiles/:id (อนุมัติร้านค้า)
    API->>DB: UPDATE seller_profiles (approved - ปล็อกสิทธิ์ลงขาย)

    Note over User, DB: เฟสที่ 1: การเสนอราคาประมูล (Bidding Phase)
    User->>API: POST /auctions/:id/bids (ยื่นเสนอราคา)
    API->>DB: SELECT * FROM listings (เช็คสถานะ active และราคา)
    API->>DB: INSERT INTO bids & UPDATE listings.current_price (ไม่กันเงินล่วงหน้า)
    API->>Worker: Check Auto-Extend (ถ้าบิดใน <= 2 นาที ขยายเวลาเพิ่ม)

    Note over User, DB: เฟสที่ 2: ปิดประมูลอัตโนมัติและสร้างคำสั่งซื้อ (Auto-Closing)
    Worker->>DB: SELECT * FROM listings WHERE end_time <= NOW()
    Worker->>DB: UPDATE listings (status = 'ended') & Get max bidder
    Worker->>DB: INSERT INTO orders (status = 'pending_payment', 48 hrs deadline)
    Worker->>DB: INSERT INTO platform_fees (5%) & Send Notification

    Note over User, DB: เฟสที่ 3 & 4: การชำระเงินและแอดมินตรวจสอบสลิป (Payment & Verification)
    User->>API: POST /orders/:orderId/slip (ชำระเงิน/แนบสลิป)
    API->>DB: INSERT INTO payments (status = 'pending_verification') & orders (paid_pending_verification)
    Admin->>API: PATCH /admin/payments/:id/verify (แอดมินตรวจสลิปภายใน 24 ชม.)
    API->>DB: UPDATE payments (success) & orders (pending_shipping)
    API->>DB: INSERT INTO escrows (status = 'held')

    Note over User, DB: เฟสที่ 5: การจัดส่งสินค้า (Shipping Phase)
    User->>API: POST /orders/:orderId/shipment (กรอกบริษัทขนส่งและ Tracking)
    API->>DB: INSERT INTO shipments & UPDATE orders (status = 'shipped')

    Note over User, DB: เฟสที่ 6: การตรวจรับสินค้าและปิดคำสั่งซื้อ (Delivery & Completion)
    User->>API: POST /orders/:orderId/confirm-delivery (ผู้ซื้อกดรับของ / ออโต้ 7 วัน)
    API->>DB: UPDATE orders (status = 'completed')
    API->>DB: Unlock reviews table (เปิดสิทธิ์ให้รีวิวกันได้)

    Note over User, DB: เฟสที่ 7: การปล่อยเงิน Escrow และโอนเข้ากระเป๋าผู้ขาย (Payout)
    API->>DB: Trigger Event (Order Status = completed)
    API->>DB: UPDATE escrows (status = 'released')
    API->>DB: UPDATE wallets (บวกเงินสุทธิหลังหักค่าธรรมเนียม 5%) & INSERT wallet_transactions


    