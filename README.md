# Rakadee — เว็บประมูลสินค้าออนไลน์

งานรายวิชา CSI204 ระบบประมูลสินค้าออนไลน์แบบ real-time พร้อม Mock Wallet, Escrow และระบบจัดการข้อพิพาท

## ติดตั้งและรัน

ต้องมี [Node.js](https://nodejs.org) 20 ขึ้นไป และ MySQL 8

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# แก้ค่า DB_* ใน .env ให้ตรงกับ MySQL ในเครื่อง
npm run dev
```

เปิด http://localhost:3000 หน้าแรกจะแสดงสถานะ API และ Database

- `npm run dev` รีสตาร์ตเองเมื่อแก้ไฟล์ (ใช้ตอนพัฒนา)
- `npm start` รันปกติ

> ตอนนี้ยังไม่มีตาราง ถ้า Database ขึ้นว่า unavailable ให้เช็กว่า MySQL เปิดอยู่และสร้าง database ชื่อ `rakadee` แล้ว (`CREATE DATABASE rakadee;`) ตารางจะมาพร้อม ERD ของ SA

## ใช้ AI เขียนโค้ด

ทุกคนในทีมใช้ AI ช่วยเขียนโค้ด กติกาทั้งหมดอยู่ใน [`AGENTS.md`](AGENTS.md) (Claude Code อ่านผ่าน `CLAUDE.md` ส่วน Cursor/Copilot/Codex อ่าน `AGENTS.md` เอง)

ทุกครั้งที่สั่งงาน AI ให้แนบหรือชี้ไปที่:

1. `AGENTS.md`
2. `docs/decision-log.md`
3. `docs/erd/schema.sql` และ `docs/api-spec/openapi.yaml`
4. ข้อในเอกสาร requirement ที่เกี่ยวกับงานนั้น

ตัวอย่างคำสั่ง:

> อ่าน AGENTS.md, docs/decision-log.md, docs/erd/schema.sql และ docs/api-spec/openapi.yaml ก่อน แล้วทำ API ลงสินค้า (POST /api/listings) ตาม requirement ข้อ 3.1–3.3 ที่แนบมา ทำเฉพาะโมดูลลงสินค้า ห้ามแก้ไฟล์โมดูลอื่น เสร็จแล้วบอกวิธีทดสอบทีละขั้น

## โครงสร้าง

```
backend/    Express API, Socket.IO, Scheduler (node-cron)
frontend/   HTML / CSS / JS (เสิร์ฟจาก backend ที่ port เดียวกัน)
docs/       Decision Log, ERD, API Spec
```

รายละเอียดโฟลเดอร์และกติกาการเขียนโค้ดอยู่ใน `AGENTS.md`

## การทำงานร่วมกัน

- `main` = เวอร์ชันพร้อมเดโม, `dev` = รวมงานระหว่างพัฒนา
- แตก branch จาก `dev` ชื่อ `feature/<module>-<งาน>` แล้วเปิด Pull Request เข้า `dev` ให้ PM review
- ห้าม push ตรงเข้า `main` หรือ `dev`

## ทีม

| ตำแหน่ง | โมดูล |
| --- | --- |
| PM | Foundation, Notification, Settings, Shipping, Admin Dashboard, Audit Log |
| SA | Auth, Wallet, Payment, Escrow, ERD, API Spec |
| QA | ลงสินค้า, อนุมัติสินค้า, Dispute, บทลงโทษ, จัดการผู้ใช้, Test Plan |
| Programmer | Auction Engine, หน้าแรก, ค้นหา, รายละเอียดสินค้า, Watchlist |



## System Architecture & Sequence Diagram

### 1. โครงสร้างระบบ (Actors & Components)
1. **`User / Browser`** (ฝั่งผู้ใช้: ผู้ซื้อ/ผู้ขาย)
2. **`Admin Dashboard`** (ฝั่งแอดมิน)
3. **`API Server`** (หลังบ้าน / Backend Controller)
4. **`Worker`** (ระบบรันอัตโนมัติเบื้องหลัง เช่น เช็คเวลาหมดประมูล)
5. **`Database`** (ฐานข้อมูลหลักของระบบ)

### 2. ลำดับขั้นตอนการทำงานของระบบ (Sequence Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant API as API Server
    actor Admin as Admin Dashboard
    participant Worker as Worker (Cron Job)
    participant DB as Database

    %% เฟส 0: KYC & Role Assignment
    Note over User, DB: เฟส 0: KYC Verification & Role
    User->>API: อัปโหลดรูปบัตรประชาชน
    API->>DB: บันทึกข้อมูลลงตาราง kyc_verifications (สถานะ PENDING)
    Admin->>API: ตรวจสอบความถูกต้องและกดอนุมัติ
    API->>DB: อัปเดตตาราง KYC เป็น APPROVED และเปลี่ยน role ใน users เป็น BIDDER
    Note over User, DB: หากต้องการขาย: ส่งคำขอเปิดร้านค้าไปที่ seller_profiles รอแอดมินอนุมัติ

    %% เฟส 1: Bidding
    Note over User, DB: เฟส 1: Bidding (ประมูลสินค้า)
    User->>API: ยิง API ส่งยอดประมูล
    API->>DB: เช็ก listings และ wallets -> บันทึก bids & อัปเดต current_price

    %% เฟส 2: Auto-Closing & Order Creation
    Note over Worker, DB: เฟส 2: Auto-Closing (Worker ทำงานทุกนาที)
    Worker->>DB: กวาดหา listings ที่หมดเวลา (end_time <= NOW)
    DB->>DB: เปลี่ยนสถานะเป็น ENDED + ดึง Bid สูงสุดสร้าง orders (PENDING_PAYMENT) + คำนวณค่าธรรมเนียม 5% ลง platform_fees

    %% เฟส 3-4: Payment & Admin Verification
    Note over User, DB: เฟส 3-4: Payment & Verification
    User->>API: โอนเงินและแนบสลิป
    API->>DB: บันทึก payments (PENDING_VERIFICATION)
    Admin->>API: ตรวจสลิปหลังบ้านและกดอนุมัติ (SUCCESS)
    API->>DB: เปลี่ยน order เป็น PENDING_SHIPPING + พักเงินใน escrows (HELD)

    %% เฟส 5: Shipping
    Note over User, DB: เฟส 5: Shipping (จัดส่งสินค้า)
    User->>API: ผู้ขายกรอกเลขพัสดุ
    API->>DB: บันทึก shipments + เปลี่ยนสถานะ order เป็น SHIPPED

    %% เฟส 6: Delivery & Completion
    Note over User, DB: เฟส 6: Delivery & Completion
    User->>API: กดยืนยันรับสินค้า (หรือครบกำหนด 7 วัน)
    API->>DB: เปลี่ยน order เป็น COMPLETED + เปิดสิทธิ์รีวิวผ่าน reviews

    %% เฟส 7: Escrow Release & Payout
    Note over Worker, DB: เฟส 7: Escrow Release & Payout
    Worker->>DB: เมื่อ order เป็น COMPLETED -> ปลดล็อก escrows เป็น RELEASED
    DB->>DB: หักค่าธรรมเนียม โอนเงินเข้า wallets + wallets_transactions
```