# เอกสาร QA (เจ้าของ: QA)

| ไฟล์ | เนื้อหา | สถานะ |
| --- | --- | --- |
| `test-plan-and-test-cases.pdf` | Test Plan + Test Case 104 เคส (11 โมดูล) | ใช้ได้ ต้องปรับบางเคสตามรายการด้านล่าง |
| `review-erd-api-spec.pdf` | รายงาน Review ERD และ API Spec ฉบับแรกของ SA (52 ข้อสังเกต) | ปิดครบแล้วใน `docs/erd/schema.sql`, `docs/api-spec/api-spec.md` และ D-07 ถึง D-12 |

## Test Case ที่ต้องปรับให้ตรงกับ ERD / API Spec ฉบับใหม่

| Test Case | เหตุผล | ปรับเป็น |
| --- | --- | --- |
| TC-16, TC-17 | ทดสอบ KYC ซึ่งตัดออกแล้ว (D-07, D-09) | เปลี่ยนเป็นทดสอบเข้ารหัสเลขบัตรตอนสมัคร (API ส่งแค่ `idCardLast4`) และยืนยันอีเมลด้วยลิงก์ (API 1.8) |
| TC-21 | เปิดร้านต้องผ่าน KYC และกรอกบัญชีธนาคาร | ยื่นเปิดร้าน (API 3.1) ต้องยืนยันอีเมล + มีที่อยู่ → `pending` → แอดมินอนุมัติจึงได้ role seller (D-18) ทดสอบ `EMAIL_NOT_VERIFIED`, `ADDRESS_REQUIRED`, `APPLICATION_PENDING`, `ALREADY_SELLER` |
| TC-42 | คาดหวังว่าบิดเกินยอด Wallet ถูกปฏิเสธ | บิดได้ทั้ง 10,000 และ 10,001 เพราะไม่เช็กยอดตอนบิด (D-06) |
| TC-45 (c) | คาดหวังว่าตั้ง Proxy เกินยอด Wallet ถูกปฏิเสธ | ตั้งได้ ไม่เช็กยอด Wallet (D-06) |
| เพิ่มใหม่ | กฎ Proxy Bid ใหม่ D-13 ถึง D-16 | ใช้ตัวอย่าง 1–4, E1–E20 และ R1–R4 ใน `docs/auction/proxy-bid-algorithm.pdf` เป็นเคสทดสอบ Auction Engine |
| TC-47 | อ้าง "วงเงินไม่พอ" ใน Wallet | ใช้ "วงเงิน Proxy ไม่พอ" แทน (ระบบหยุดบิดแทนและแจ้งเตือน) |
| TC-59 | ทดสอบเติมเงิน (DEPOSIT) | ทดสอบเครดิตแรกเข้า 10,000 บาทครั้งเดียวและประวัติธุรกรรม (API 7.1, 7.2) |
| TC-61 | เติมเงินแล้วชำระใหม่ | ยอดไม่พอ → `INSUFFICIENT_BALANCE` พร้อม `shortfall` ปุ่มชำระกดไม่ได้ (ไม่มีเติมเงิน) |
| TC-68 | ตรวจยอดรวมโดยมีสถานะ FROZEN | ใช้สูตรตรวจยอดใน D-10 (ไม่มี FROZEN) |
| TC-73, TC-81, TC-84, TC-85 | คาดหวัง Escrow = FROZEN ระหว่างข้อพิพาท | Escrow = `held` + Order = `disputed` และ release ไม่ได้จนตัดสิน (D-08) |
| TC-93 | อ้าง action อนุมัติ KYC และรีวิว | ใช้รายการ action ใน API Spec หัวข้อ 11 |
| ทุกเคส | ชื่อ endpoint `/auctions`, error code `ERR_*`, สถานะตัวพิมพ์ใหญ่ | ใช้ path, error code และค่าสถานะตาม `docs/api-spec/api-spec.md` |

บัญชีทดสอบและข้อมูลตั้งต้นอยู่ใน `backend/seeds/001_seed.sql` ย่อเวลา (48 ชม., 7 วัน ฯลฯ) ผ่านตัวแปรใน `backend/.env` ตาม `.env.example`

## อัพเดทงาน

#### ไฟล์ที่สร้างใหม่
| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/pages/seller/open-shop.html` + `js/seller/open-shop.js` | ฟอร์มเปิดร้าน (3.1); redirect ถ้าเป็น seller แล้ว |
| `frontend/pages/seller/listings.html` + `js/seller/listings.js` | "สินค้าของฉัน" แท็บ 6 สถานะ, cancel in-line (4.9/4.8) |
| `frontend/pages/seller/listing-form.html` + `js/seller/listing-form.js` | ฟอร์มลงสินค้าแบบ single-page 4 ส่วน, upload รูป, preview, validate ครบ 3.3, save draft/submit/cancel (4.2–4.8) |
| `frontend/pages/admin/listings.html` + `js/admin/listings.js` | ตารางรออนุมัติ + แท็บสถานะ + ค้นหา (4.10) |
| `frontend/pages/admin/listing-detail.html` + `js/admin/listing-detail.js` | รายละเอียดเต็ม + approve + reject modal (4.11–4.13) |
| `frontend/css/admin.css` | สไตล์โครงหน้า Admin |
| `frontend/js/admin/admin-shell.js` | สร้างโครงหน้า Admin ให้ทุกหน้า admin (ใช้แทน `layout.js` ที่ยังไม่ได้ตกแต่ง สามารถแทนได้ถ้าทำมาเพิ่มแล้ว) |
| `backend/src/services/seller.service.js` | openShop, getMyProfile, updateMyProfile, getPublicProfile |
| `backend/src/services/listing.service.js` | getCategories, createListing, updateListing, addImages, deleteImage, setCover, submitListing, cancelListing, getMyListings + serializeListingDetail (ListingDetail ของ QA) |
| `backend/src/services/admin.listing.service.js` | adminListListings, adminGetListing, approveListing, rejectListing |
| `backend/src/controllers/seller.controller.js` | controller 3.1–3.4 |
| `backend/src/controllers/listing.controller.js` | controller 4.1–4.9 |
| `backend/src/controllers/admin.listing.controller.js` | controller 4.10–4.13 |
| `backend/src/routes/seller.routes.js` | mount seller profile + 4.9 |
| `backend/src/routes/listing.routes.js` | mount 4.2–4.8 |
| `backend/src/routes/admin.listing.routes.js` | mount 4.10–4.13 |
| `backend/src/utils/parseId.js` | guard URL param ให้เป็น integer บวก → 400 ถ้าว่างหรือไม่ใช่เลข |

#### Endpoint ที่ทำแล้ว
| # | Method | Path | สถานะ |
|---|---|---|---|
| 3.1 | POST | `/api/seller/profile` | ✅ |
| 3.2 | GET | `/api/seller/profile` | ✅ |
| 3.3 | PUT | `/api/seller/profile` | ✅ |
| 3.4 | GET | `/api/sellers/:userId` | ✅ |
| 4.1 | GET | `/api/categories` | ✅ |
| 4.2 | POST | `/api/listings` | ✅ |
| 4.3 | PUT | `/api/listings/:id` | ✅ |
| 4.4 | POST | `/api/listings/:id/images` | ✅ |
| 4.5 | DELETE | `/api/listings/:id/images/:imageId` | ✅ |
| 4.6 | POST | `/api/listings/:id/images/:imageId/cover` | ✅ |
| 4.7 | POST | `/api/listings/:id/submit` | ✅ |
| 4.8 | POST | `/api/listings/:id/cancel` | ✅ |
| 4.9 | GET | `/api/seller/listings` | ✅ |
| 4.10 | GET | `/api/admin/listings` | ✅ |
| 4.11 | GET | `/api/admin/listings/:id` | ✅ |
| 4.12 | POST | `/api/admin/listings/:id/approve` | ✅ |
| 4.13 | POST | `/api/admin/listings/:id/reject` | ✅ |

## FE
เปิดร้าน: `/pages/seller/open-shop.html` (ใช้ token buyer)
ลงสินค้า: `/pages/seller/listing-form.html` (ใช้ token seller)
สินค้าของฉัน: `/pages/seller/listings.html` (ใช้ token seller)
Admin ตรวจสอบ: `/pages/admin/listings.html` (ใช้ token admin)
Admin รายละเอียด: `/pages/admin/listing-detail.html` (ใช้ token admin)

## งานต่อไปที่ต้องทำ Phase 2
งาน QA
Dispute (ข้อ 6.2-2, 6.4, 7, 8.2-4, API 9)
-ฟอร์มเปิดข้อพิพาท: ประเภทปัญหา รายละเอียด หลักฐาน (หลายรูป) ช่องทางติดต่อ เปิดได้เฉพาะก่อนเงิน
ถูกปล่อย
-เปิดแล้วล็อก Escrow (autoRelease ต้องข้าม) และ Order เป็น "อยู่ระหว่างตรวจสอบข้อพิพาท"
-หน้าผู้ขายส่งหลักฐานฝั่งตัวเอง
-สถานะข้อพิพาท 6 ค่าตามข้อ 1.7-7
-Admin: ตารางข้อพิพาท, หน้ารายละเอียด (ไทม์ไลน์ Order, หลักฐานสองฝั่ง), ปุ่มตัดสินคืนเงินผู้ซื้อ
(escrow. refund() + ยกเลิก Order) หรือปล่อยเงินผู้ขาย (escrow.release())

บทลงโทษ (ข้อ 7.1-7.3 และ D-03 , API 10)
-penalty.add(userId, type) บันทึกแต้ม และเปลี่ยนสถานะ: ไม่จ่ายครั้งที่ 2 เป็น suspended 7
วัน,ไม่ส่งของซ้ำเป็น restricted
-Scheduler restoreStatus : ครบกำหนดแล้วคืนเป็น active
-Shill detection: flag เมื่อผู้บิดใช้ IP หรืออุปกรณ์เดียวกับผู้ขาย หรือบิดร้านเดิมซ้ำผิดปกติ แสดงในหน้า
แอดมิน

จัดการผู้ใช้ (ข้อ 8.2-5,8.1 , API 10)
-ตารางสมาชิก: ค้นหาชื่อ อีเมล เบอร์, กรองสถานะ
-หน้าโปรไฟล์ในมุมแอดมิน: ประวัติประมูล ประวัติขาย ยอด Wallet ประวัติความผิด ประวัติธุรกรรม
-เปลี่ยนสถานะบัญชี, แบนพร้อมเพิ่มเลขบัตร (hash) และเบอร์เข้า blacklists
-สิทธิ์: Admin ห้ามลบข้อมูลสำคัญ ห้ามแก้ยอด Wallet ห้ามจัดการแอดมินคนอื่น ส่วน Super Admin
ทำได้ทั้งหมด

งานเพิ่ม
-เปิดร้านแบบใหม่: ยื่นแล้วเป็น pending ไม่ตั้ง role seller
ทันที, ตรวจอีเมลยืนยันแล้ว + ที่อยู่, หน้า "รออนุมัติ / ไม่ผ่าน
เพราะ ... " (D-18, API 3.1-3.4)
-หน้าแอดมินตรวจร้าน: รายการคำขอ, รายละเอียดผู้สมัคร, ปุ่ม
อนุมัติ / ไม่อนุมัติ (บังคับเหตุผล) + notify + audit.log (D-18, API 3.5-3.8)
-เมนูแอดมิน: เปลี่ยนไอคอนหัวใจเป็นกระดึ่งพร้อมคำว่า "แจ้ง
เตือน", เพิ่มเมนู "ตรวจร้านค้า" (คำแนะนำข้อ 2)

คําแนะนําแต่ละข้อ
-2.ปุ่มหัวใจในหน้าแอดมินไม่ชัด (จริงๆ คือ
ปุ่มแจ้งเตือน)
-3.จัดการผู้ใช้ บล็อก / แบนบัญชี
-3.ผู้ขายต้องตรวจความน่าเชื่อถือ บัญชี ที่
อยู่


## อัพเดทงาน Phase 2

งาน QA Phase 2 (ข้อพิพาท, บทลงโทษ, จัดการผู้ใช้, เปิดร้านแบบใหม่ D-18) ทั้ง BE และ FE รวมเข้ากับงานของเพื่อน PR #11–#17 แล้ว
อ้างอิง D-03, D-08, D-18 และ api-spec หัวข้อ 3, 9, 10

#### ไฟล์ที่สร้างใหม่
| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/routes/admin.seller.routes.js` | mount แอดมินตรวจร้าน 3.5–3.8 |
| `backend/src/services/dispute.service.js` | ข้อพิพาท 9.1–9.6 + `listMine` (ข้อพิพาทของฉัน) |
| `backend/src/services/dispute.js` | Interface `dispute.isOpen(orderId)` ให้ SA (escrow) / PM (autoRelease) เรียก |
| `backend/src/controllers/dispute.controller.js` | controller 9.1–9.6 + ข้อพิพาทของฉัน |
| `backend/src/routes/dispute.routes.js` | mount 9.1–9.3 + `GET /api/disputes` (อัปโหลดหลักฐาน ≤ 5 รูป) |
| `backend/src/services/penalty.js` | Interface `penalty.add(userId, type, { orderId, note })` บันทึกความผิด + เปลี่ยนสถานะ (ไม่ลดระดับสถานะเดิม) |
| `backend/src/services/admin.user.service.js` | จัดการผู้ใช้ + แบน/ปลดแบน + บิดน่าสงสัย 10.1–10.7 |
| `backend/src/controllers/admin.user.controller.js` | controller 9.4–9.6, 10.1–10.7 |
| `backend/src/routes/admin.qa.routes.js` | mount 9.4–9.6, 10.1–10.7 (10.5 เฉพาะ super_admin) |
| `backend/src/jobs/restoreStatus.js` | Scheduler คืน restricted/suspended ที่ครบกำหนดเป็น active (ทุก 1 นาที) |
| `backend/src/jobs/detectShill.js` | Scheduler บันทึก suspicious_flags: IP เดียวกับผู้ขาย, บิดร้านเดิม ≥ 5 รายการใน 7 วัน (ไม่สร้างซ้ำ) |
| `frontend/css/qa.css` | สไตล์ร่วมของ QA: ป้ายสถานะ, stepper, รูปหลักฐาน, ไทม์ไลน์, modal, ตาราง, wizard (ใช้ตัวแปรสีจาก `main.css`) |
| `frontend/js/qa-common.js` | ตัวช่วยร่วม: `qa.el()` ใส่ข้อความด้วย textContent, ป้ายสถานะภาษาไทย, modal, เลือกไฟล์ + preview, แบ่งหน้า, `qa.requireAdmin()` |
| `frontend/js/seller/seller-nav.js` | sidebar ผู้ขาย: แดชบอร์ด, สินค้าของฉัน, ลงสินค้าใหม่, รอจัดส่ง (PM), การเงินผู้ขาย (SA), ข้อพิพาท |
| `frontend/pages/seller/dashboard.html` + `js/seller/dashboard.js` | แดชบอร์ดผู้ขาย (ภาพ 28) ดึง 4.9, 8.3, 7.1, 7.3 |
| `frontend/pages/seller/listing-preview.html` + `js/seller/listing-preview.js` | ตัวอย่างสินค้าก่อนส่งตรวจ (ภาพ 34) |
| `frontend/pages/seller/disputes.html` + `js/seller/disputes.js` | รายการข้อพิพาทฝั่งผู้ขาย แท็บ กำลังดำเนินการ / สิ้นสุด / ทั้งหมด |
| `frontend/pages/dispute-open.html` + `js/dispute-open.js` | ผู้ซื้อเปิดข้อพิพาท (ภาพ 21) เช็กสิทธิ์จาก 8.2 ก่อนกรอก |
| `frontend/pages/disputes.html` + `js/disputes.js` | ติดตามข้อพิพาท มุมผู้ซื้อ (ภาพ 22) / มุมผู้ขาย (ภาพ 38) + ส่งหลักฐานเพิ่ม |
| `frontend/pages/admin/seller-applications.html` + `js/admin/seller-applications.js` | แอดมินรายการคำขอเปิดร้าน (3.5) |
| `frontend/pages/admin/seller-application.html` + `js/admin/seller-application.js` | รายละเอียดผู้สมัคร + อนุมัติ / ไม่อนุมัติ บังคับเหตุผล (3.6–3.8) |
| `frontend/pages/admin/disputes.html` + `js/admin/disputes.js` | แอดมินรายการข้อพิพาท แท็บ กำลังดำเนินการ / สิ้นสุด / ทั้งหมด (9.4) |
| `frontend/pages/admin/dispute-detail.html` + `js/admin/dispute-detail.js` | แอดมินจัดการข้อพิพาท: ไทม์ไลน์ Order, หลักฐานสองฝั่ง, เปลี่ยนสถานะ, modal ตัดสิน (ภาพ A5) |
| `frontend/pages/admin/users.html` + `js/admin/users.js` | จัดการผู้ใช้ (ภาพ A6): ตาราง + แผงโปรไฟล์ + ระงับ/แบน/คืนสถานะ/ปลดแบน + แท็บ "บิดน่าสงสัย" (10.1–10.7) |
| `frontend/pages/admin/suspicious-flags.html` | หน้าส่งต่อไป `users.html?tab=flags` |
| `frontend/pages/admin/sellers.html` | หน้าส่งต่อไป `seller-applications.html` (การ์ด "ร้านค้ารออนุมัติ" ในแดชบอร์ด PM ลิงก์มาที่นี่) |

#### Endpoint ที่ทำแล้ว
| # | Method | Path | สถานะ |
|---|---|---|---|
| 3.1 | POST | `/api/seller/profile` | ✅ แก้ตาม D-18: ยื่นแล้วเป็น `pending` role ยังไม่เปลี่ยน, ต้องยืนยันอีเมล + มีที่อยู่, ยื่นใหม่ได้หลังถูกปฏิเสธ |
| 3.2 | GET | `/api/seller/profile` | ✅ แก้: สิทธิ์ `member`, ตอบ `null` ถ้ายังไม่เคยยื่น |
| 3.3 | PUT | `/api/seller/profile` | ✅ แก้: เฉพาะร้าน `approved` |
| 3.4 | GET | `/api/sellers/:userId` | ✅ แก้: เฉพาะร้าน `approved` |
| 3.5 | GET | `/api/admin/seller-applications` | ✅ |
| 3.6 | GET | `/api/admin/seller-applications/:userId` | ✅ |
| 3.7 | POST | `/api/admin/seller-applications/:userId/approve` | ✅ notify + audit.log (บัญชีที่ถูกแบนอนุมัติไม่ได้) |
| 3.8 | POST | `/api/admin/seller-applications/:userId/reject` | ✅ บังคับเหตุผล + notify + audit.log |
| 9.1 | POST | `/api/orders/:id/disputes` | ✅ |
| 9.2 | GET | `/api/disputes/:id` | ✅ |
| 9.3 | POST | `/api/disputes/:id/evidence` | ✅ |
| 9.x | GET | `/api/disputes?role=&status=` | ✅ ⚠ เพิ่มจาก spec (ข้อพิพาทของฉัน) รอ SA เพิ่มใน api-spec |
| 9.4 | GET | `/api/admin/disputes` | ✅ (+ `status=active` เพิ่มจาก spec) |
| 9.5 | PATCH | `/api/admin/disputes/:id/status` | ✅ (ยังไม่แจ้งเตือน รอ event จาก SA/PM) |
| 9.6 | POST | `/api/admin/disputes/:id/resolve` | ✅ refund_buyer / release_seller |
| 10.1 | GET | `/api/admin/users` | ✅ (+ `fullName`, `idCardLast4`) |
| 10.2 | GET | `/api/admin/users/:id` | ✅ |
| 10.3 | POST | `/api/admin/users/:id/status` | ✅ |
| 10.4 | POST | `/api/admin/users/:id/ban` | ✅ |
| 10.5 | POST | `/api/admin/blacklists/:id/revoke` | ✅ super_admin เท่านั้น |
| 10.6 | GET | `/api/admin/suspicious-flags` | ✅ |
| 10.7 | POST | `/api/admin/suspicious-flags/:id/review` | ✅ |

| Interface / Scheduler | สถานะ | ใครเรียก |
|---|---|---|
| `penalty.add(userId, type, { orderId, note })` | ✅ | SA `paymentTimeout` (`non_payment`), PM 8.6 ยกเลิก Order (`no_shipment`), QA 10.4 (`admin_ban`) |
| `dispute.isOpen(orderId)` | ✅ | PM `autoRelease`, ยืนยันรับสินค้า, บันทึกจัดส่ง |
| Scheduler `restoreStatus` | ✅ | ทุก 1 นาที |
| Scheduler `detectShill` | ✅ `same_ip`, `repeated_seller` (ยังไม่มี `same_device`) | ทุก 1 นาที |

## ไฟล์ที่แก้

ไฟล์ของ QA:
| ไฟล์ | แก้อะไร |
|---|---|
| `backend/src/services/seller.service.js` | เปิดร้านตาม D-18 + แอดมินตรวจร้าน 3.5–3.8 |
| `backend/src/controllers/seller.controller.js` | เพิ่ม controller 3.5–3.8 |
| `backend/src/routes/seller.routes.js` | 3.2 เปลี่ยนสิทธิ์จาก `seller` เป็น `member` |
| `backend/src/services/listing.service.js` | `defectDetail` บังคับทั้ง `used_good` และ `defective` และบันทึกได้ถูกต้อง · 4.9 เพิ่ม `durationDays` · ListingDetail เพิ่ม `maxExtendCount`, `me` (`buildMe()`) ตาม spec |
| `backend/src/services/admin.listing.service.js`, `controllers/admin.listing.controller.js` | 4.11 ส่ง `me` ของแอดมิน |
| `frontend/pages/seller/open-shop.html` + `js/seller/open-shop.js` | ทำใหม่ตาม D-18: เลือกที่อยู่, เช็กอีเมลยืนยัน, หน้า "รออนุมัติ / ไม่ผ่านเพราะ..." |
| `frontend/pages/seller/listings.html` + `js/seller/listings.js` | ตารางตามภาพ 29 + แท็บ + แถบเหตุผลที่ไม่อนุมัติ |
| `frontend/pages/seller/listing-form.html` + `js/seller/listing-form.js` | wizard 4 ขั้นตามภาพ 30–33, ช่องตำหนิบังคับสำหรับมือสอง, สวิตช์ซื้อทันที, ตัวอย่างรายได้ (ระบุว่าใช้ค่าธรรมเนียมเริ่มต้น) |
| `frontend/pages/admin/listings.html` + `js/admin/listings.js` | รายการ + แผงรายละเอียดด้านขวา (ภาพ A2), modal ปฏิเสธพร้อมเหตุผลด่วน, กล่องยืนยันอนุมัติ |
| `frontend/js/admin/admin-shell.js` + `css/admin.css` | โครงหน้าแอดมินตามภาพ: sidebar "R Admin", กระดิ่ง "แจ้งเตือน" แทนหัวใจ (คำแนะนำข้อ 2), เมนู "ตรวจร้านค้า", "ข้อพิพาท", "ผู้ใช้" + เมนู คำสั่งซื้อ (PM), การเงิน (SA), ตั้งค่าระบบ (PM, เฉพาะ Super Admin) · คลิกอีเมลมุมขวาบนเปิดเมนู การแจ้งเตือน / ตั้งค่า / ออกจากระบบ (เอา "กลับหน้าเว็บ" และปุ่มออกจากระบบใน sidebar ออก) |
| `frontend/pages/disputes.html` | ลิงก์ `?orderId=` จากหน้าคำสั่งซื้อของ PM ส่งต่อไปฟอร์มเปิดข้อพิพาท |
| `frontend/js/admin/` listings, disputes, dispute-detail, seller-applications, seller-application, users | ใช้ `qa.requireAdmin()`: ไม่ login → หน้า login, ไม่ใช่แอดมิน → หน้าแรก |
| `frontend/js/seller/*.js`, `js/disputes.js`, `js/dispute-open.js` | ส่ง `?next=` ตอนพาไปหน้า login (เหมือนหน้า PM) |
| `backend/src/routes/index.js` (ไฟล์กลาง) | เพิ่ม 3 บรรทัด mount router ใหม่ของ QA |

แก้ไฟล์ของโมดูลอื่น 
| ไฟล์ | เจ้าของ | แก้อะไร |
|---|---|---|
| `backend/src/services/user.service.js` บรรทัด 18, 255 | PM | `isSeller` นับจาก `u.role = 'seller'` แทนการมีแถว seller_profiles (ร้าน pending/rejected เคยได้ `isSeller: true` ผิด D-18) |
| `frontend/js/layout.js` | PM | ลิงก์ "ผู้ขาย" ใน navbar ไปแดชบอร์ดผู้ขาย ตามหมายเหตุในภาพ |

`auth.js` (SA) แก้ `isSeller` เองแล้วใน PR #13 · ไม่ได้แก้ schema, api-spec และไม่ได้เพิ่ม npm package

## ปัญหาที่เจอ

ปัญหาที่เจอและแก้แล้ว:
| ปัญหา | สาเหตุ | แก้ |
|---|---|---|
| ยื่นเปิดร้านแล้วเมนูผู้ขายขึ้นทันที ทั้งที่แอดมินยังไม่อนุมัติ | `isSeller` (PM/SA) นับจากการมีแถว seller_profiles | เช็ก `role = 'seller'` |
| แอดมินอนุมัติร้านของบัญชีที่ถูกแบน แล้วบัญชีนั้นกลายเป็นผู้ขาย | 3.7 ไม่ได้เช็กสถานะบัญชี | BE ตอบ `INVALID_STATE` + ซ่อนปุ่มที่ FE |
| รายละเอียดตำหนิกดบันทึกร่างแล้วไม่ลง DB และหายเมื่อกลับมาแก้ | FE/BE เก็บ `defectDetail` เฉพาะ `defective` | เก็บเมื่อสภาพไม่ใช่ `new` และบังคับกรอกสำหรับมือสอง |
| ListingDetail ของ 4.2/4.3/4.11 ขาด `maxExtendCount`, `me` | ไม่ตรง spec (เจอจาก contract test) | เพิ่ม `buildMe()` |
| จอมือถือ หน้าแอดมิน "สินค้า" ล้น 165px, "ผู้ใช้" ล้น 259px | grid บนมือถือใช้ `1fr` | `qa.css` ใช้ `minmax(0, 1fr)` |
| เปิดหน้าแจ้งปัญหาของ Order ที่มีข้อพิพาทอยู่แล้ว ยังเห็นฟอร์มเต็ม กรอกเสร็จถึงรู้ว่าส่งไม่ได้ | ไม่ได้เช็กก่อน (ตอนทำยังไม่มี 8.2) | `dispute-open.js` เช็ก `dispute`, `canOpenDispute`, `viewerRole` จาก 8.2 แล้วซ่อนฟอร์ม |
| สมาชิกที่ login แล้วเปิดหน้าแอดมิน ถูกส่งไปหน้า login | guard รวมกรณีไม่ login กับไม่ใช่แอดมิน | `qa.requireAdmin()` |
| ลิงก์ของ PM ชี้หน้า QA ผิด: `disputes.html?orderId=`, `admin/sellers.html` | ตั้งชื่อหน้าไม่ตรงกัน | ทำหน้าส่งต่อฝั่ง QA (ไม่ต้องแก้ไฟล์ PM) |
| รูปยาวในแผงอนุมัติเห็นไม่ครบ, ตัวนับ "รอตรวจสอบ" ค้าง, ตารางข้อพิพาทผู้ขายตัดบรรทัด | CSS / โหลดข้อมูลไม่ครบ | `object-fit: contain`, nowrap, โหลดตัวนับใหม่ทุกครั้ง |

ปัญหาที่ยังค้าง (รอคนอื่น):
| ปัญหา | ต้องการจาก |
|---|---|
| ยังไม่แจ้งเตือนตอนแอดมินเปลี่ยนสถานะข้อพิพาท และตอนโดนลงโทษ / ถูกเปลี่ยนสถานะบัญชี (ไม่มี event ใน api-spec หัวข้อ 11) · ตอนตัดสินมีแจ้งเตือนเรื่องเงิน `REFUNDED` / `FUNDS_RELEASED` จาก escrow อยู่แล้ว แต่ไม่บอกผลข้อพิพาท | SA (api-spec) + PM (`notificationTemplates.js`) |
| รูปหลักฐานข้อพิพาทเปิดดูไม่ได้ (404) ไฟล์ต้องเปิดผ่าน API ที่ตรวจสิทธิ์ (แบบสลิป 7.7b / หลักฐานส่ง 8.8) แต่ยังไม่มี API นี้ใน spec | SA (api-spec) แล้ว QA ทำ endpoint |
| ระยะเวลา 7 วันของ detectShill ยังเป็นค่าสำรองในโค้ด | PM เพิ่ม `shillWindowMs` ใน `config/time.js` |
| ตัวอย่างรายได้ในหน้าลงสินค้าใช้ค่าธรรมเนียมเริ่มต้น 5% / 20 บาท เพราะ API ตั้งค่าระบบ (11.8) เปิดให้ Super Admin เท่านั้น | PM (API ให้ผู้ขายอ่านค่าธรรมเนียม) |
| `same_device` ตรวจไม่ได้ (ไม่มีข้อมูลอุปกรณ์ใน schema) | SA (schema) |
| ฟิลด์ `note` ของ 9.5 ไม่มีคอลัมน์ (เก็บใน audit log แทน) | SA (schema) |
| `paymentTimeout` เรียก `penalty.add` โดยไม่เช็กว่า UPDATE ยกเลิก Order สำเร็จ (ถ้า job ทำงานซ้อนกันอาจลงโทษซ้ำ โอกาสต่ำ) | SA |
| หน้าคำสั่งซื้อ (`order-view.js`) และแดชบอร์ดแอดมินลิงก์ไป `disputes.html?orderId=` / `admin/sellers.html` (ใช้ได้เพราะ QA ทำหน้าส่งต่อแล้ว) | PM แก้ลิงก์ให้ตรงหน้าจริงเมื่อสะดวก |
| comment `schema.sql:149` ยังเขียนว่าเปิดร้านแล้วได้ role seller ทันที (ก่อน D-18) | SA |

ฝากปรับ (ข้อแนะนำจาก QA ถ้าเจ้าของอยากใช้แบบเดิมก็บอกได้ QA จะปรับลิงก์ฝั่งตัวเองตาม):
| เรื่อง | ตอนนี้ | แนะนำ | เจ้าของ | QA ต้องทำอะไรต่อ |
|---|---|---|---|---|
| หน้าการแจ้งเตือน / ตั้งค่าของแอดมิน | แอดมินกด "การแจ้งเตือน" / "ตั้งค่า" (เมนูอีเมลมุมขวาบน) หรือปุ่มกระดิ่ง แล้วหลุดไปหน้าเว็บหลักที่มี navbar ผู้ซื้อ | เมื่อ role เป็น admin / super_admin ให้ `notifications.html`, `settings.html` ใช้โครง `admin-page` + `admin-shell.js` แทน navbar (ดูตัวอย่าง `admin/orders.html`) · การซ่อนแท็บที่แอดมินไม่ใช้ (ที่อยู่จัดส่ง, ตั้งค่าแจ้งเตือน) PM ทำไว้แล้ว | PM | ไม่ต้อง (ลิงก์ชี้หน้าเดิมอยู่แล้ว) |
| login แล้วพาไปหน้าไหน | ทุกคนไปหน้าแรก (`login.html` บรรทัด 173–176) และไม่อ่าน `?next=` | admin / super_admin → `/pages/admin/dashboard.html` · คนอื่น → `?next=` ถ้ามี (รับเฉพาะ path ภายในเว็บ ขึ้นต้น `/` แต่ไม่ใช่ `//`) ไม่มีไปหน้าแรก · `pending_verification` ยังไปหน้า OTP | SA | ไม่ต้อง (หน้า QA ส่ง `?next=` แล้ว) |
| เมนู "รอจัดส่ง" ใน sidebar ผู้ขาย | `seller/shipments.html` ใช้ sidebar สมาชิก (`account-nav`) กดแล้วเมนูด้านซ้ายเปลี่ยนเป็น การประมูลของฉัน / Watchlist / ... | ใช้ sidebar ผู้ขายแทน: `<aside class="account-nav" id="seller-nav">` + โหลด `/js/seller/seller-nav.js` แทน `account-nav.js` (แก้ 2 บรรทัด เมนู "รอจัดส่ง" จะ active เอง) | PM | ไม่ต้อง |
| เมนู "การเงินผู้ขาย" ใน sidebar ผู้ขาย (ข้อแนะนำเรื่องหน้าตา) | ลิงก์ไป `wallet.html` ซึ่งถูกตาม D-09 ("ผู้ขายดูยอดรายได้ใน Wallet") แต่หน้านั้นไม่มีเมนูผู้ขาย กดแล้วเหมือนหลุดออกจากส่วนผู้ขาย | ถ้าสะดวก ให้ `wallet.html` แสดง sidebar ผู้ขาย (`seller-nav.js`) เมื่อเป็นผู้ขาย หรือทำหน้า `seller/earnings.html` ตามภาพ UI 37 (ยอดรอรับ 7.1 + รายได้ 7.3) โดยไม่ใส่ปุ่ม "ถอนเข้า Mock Wallet" เพราะขัด D-09 | SA | ถ้าทำหน้าใหม่: เปลี่ยนลิงก์ใน `seller-nav.js` 1 บรรทัด |
| navbar ตัดบรรทัด | ผู้ขายมีลิงก์ "ผู้ขาย" เพิ่ม ทำให้เมนูบน navbar ตกไปบรรทัดที่สองบนจอกว้าง ~1900px | ให้เมนู navbar ไม่ตัดบรรทัด (`white-space: nowrap` / ลดช่องไฟ) | PM (`layout.js`, `main.css`) | ไม่ต้อง |

สิ่งที่เพิ่มหรือทำต่างจาก api-spec (ต้องให้ SA เขียนลง api-spec):
| เรื่อง | ที่ไหน | เหตุผล |
|---|---|---|
| API ใหม่ `GET /api/disputes?role=seller\|buyer&status=active\|closed\|<สถานะ>` (member) → `{ items: [{ id, orderId, listingTitle, coverUrl, type, status, resolution, totalAmount, myRole, counterparty, sellerEvidenceCount, openedAt, updatedAt }], page, limit, total }` | `dispute.service.js` `listMine()` | เมนู "ข้อพิพาท" ใน sidebar ผู้ขาย (ภาพ 28–38) ต้องมีหน้ารายการ (spec เข้าข้อพิพาทผ่าน 8.2 ได้อยู่แล้ว ถ้า SA ไม่รับ ตัดออกได้) |
| `status=active` ใน 9.4 | `dispute.service.js` `adminList()` | แท็บ "กำลังดำเนินการ" ในหน้าแอดมิน |
| `durationDays` ใน 4.9 | `listing.service.js` | คอลัมน์ระยะเวลา (ภาพ 29) |
| ขอเพิ่ม `durationDays` ใน 5.2 (`ListingDetail`) สำหรับเจ้าของสินค้า (spec ยังไม่มีฟิลด์นี้) | Programmer (หลัง SA เพิ่มใน spec) | หน้าแก้ไข / ตัวอย่างสินค้าต้องใช้ ตอนนี้ FE หาจาก 4.9 แทน (`qa.ownerDurationDays()`) |
| `fullName`, `idCardLast4` ใน 10.1 | `admin.user.service.js` | คอลัมน์ชื่อ / บัตร ปชช. (ภาพ A6) ส่งแค่ 4 ตัวท้าย |
| `defectDetail` บังคับทั้ง `used_good` และ `defective` (spec 4.2 เขียนแค่ `defective`) | `listing.service.js` | ภาพ UI "บังคับสำหรับสินค้ามือสอง" + ข้อ 3.1-1f |
| response ของ 9.4, 10.6 และฟิลด์ใน `recentBids` / `recentOrders` / `transactions` ของ 10.2 | `dispute.service.js`, `admin.user.service.js` | spec ยังไม่กำหนด ทำตามที่หน้าเว็บใช้ |

## สรุปผลเทส

ทดสอบบนโค้ดที่รวม PR #11–#17 แล้ว กับฐานข้อมูลใหม่จาก `schema.sql` + `001_seed.sql` (22 พ.ย. 69) ผู้ใช้ในชุดเทสหลักสมัครผ่าน API จริง (register → OTP → ยืนยันอีเมล → เปิดร้าน → แอดมินอนุมัติ)

| ชุดเทส | ผล |
|---|---|
| Contract test api-spec หัวข้อ 3, 4, 9, 10 (status, ฟิลด์, error code, สิทธิ์) | ✅ 117/117 |
| จุดเชื่อม QA กับงานเพื่อน (penalty จาก PM/SA, autoRelease ข้ามข้อพิพาท, 8.2 แสดงข้อพิพาท) | ✅ 9/9 |
| Auth (SA) | ✅ 22/22 |
| เปิดร้านด้วยบัญชีจาก Auth จริง | ✅ 3/3 |
| ลงสินค้า → ประมูล → ปิด → Order (cross-test QA × Programmer × PM) | ✅ 10/10 |
| เงิน Payment / Escrow / Shipping | ✅ 32/32 |
| Auction (Programmer) | ✅ 19/19 |
| สถานะบัญชี D-03 กับสิทธิ์ bid / sell, restoreStatus, detectShill, แบน + blacklist | ✅ 7/7 |
| หน้า FE ทุกหน้า (41 หน้า) ด้วยบัญชีผู้ขาย / ผู้ซื้อ / แอดมิน / Super Admin ตาม role ที่ใช้หน้านั้น บนจอ 1280 และ 375 px | ✅ ไม่มี HTTP/JS error ไม่มี scroll แนวนอน (หลังแก้ 3 จุด) ยกเว้นรูปหลักฐาน 404 (ค้างข้างบน) |
| เมนูบัญชีแอดมิน (คลิกอีเมลมุมขวาบน) หลังปรับ | ✅ 7/7 |

#### เช็กลิสต์งาน QA Phase 2
| งาน | ผล |
|---|---|
| ฟอร์มเปิดข้อพิพาท: ประเภท รายละเอียด หลักฐานหลายรูป ช่องทางติดต่อ เปิดได้เฉพาะก่อนเงินถูกปล่อย | ✅ |
| เปิดแล้ว Escrow ยัง `held` ปล่อยไม่ได้ (autoRelease ข้าม, ยืนยันรับไม่ได้) และ Order เป็น `disputed` | ✅ |
| ผู้ขายส่งหลักฐานฝั่งตัวเอง | ✅ |
| สถานะข้อพิพาท 6 ค่าตามข้อ 1.7-7 | ✅ |
| แอดมิน: ตารางข้อพิพาท, รายละเอียด (ไทม์ไลน์ Order, หลักฐานสองฝั่ง), ตัดสินคืนเงินผู้ซื้อ / ปล่อยเงินผู้ขาย | ✅ (รูปหลักฐานยังเปิดไม่ได้ รอ API) |
| `penalty.add`: ไม่จ่ายครั้งที่ 2 → suspended 7 วัน, ไม่ส่งของครั้งที่ 2 → restricted | ✅ ทดสอบผ่าน job ของ SA และ API ของ PM จริง |
| `restoreStatus` ครบกำหนดคืน active | ✅ |
| Shill detection แสดงในหน้าแอดมิน | ✅ IP เดียวกัน + บิดร้านเดิมซ้ำ · ❌ อุปกรณ์เดียวกัน (ไม่มีข้อมูลใน schema) |
| ตารางสมาชิก: ค้นหาชื่อ อีเมล เบอร์ กรองสถานะ | ✅ |
| โปรไฟล์มุมแอดมิน: ประวัติประมูล ขาย Wallet ความผิด ธุรกรรม | ✅ |
| เปลี่ยนสถานะ, แบน + blacklist (เลขบัตร hash + เบอร์) | ✅ สมัครใหม่ด้วยเลขบัตรที่ถูกแบนได้ `BLACKLISTED` |
| สิทธิ์ Admin / Super Admin | ✅ Admin แก้/แบนแอดมินไม่ได้, ปลดแบนไม่ได้, ไม่มี API แก้ยอด Wallet |
| เปิดร้าน D-18: pending, ต้องยืนยันอีเมล + ที่อยู่, หน้า "รออนุมัติ / ไม่ผ่านเพราะ..." | ✅ |
| แอดมินตรวจร้าน: รายการ, รายละเอียด, อนุมัติ / ไม่อนุมัติ (บังคับเหตุผล) + notify + audit.log | ✅ |
| เมนูแอดมิน: กระดิ่ง "แจ้งเตือน" แทนหัวใจ, เมนู "ตรวจร้านค้า" | ✅ |

#### เทส Auth (SA หลัง merge)
ผ่านทั้งหมด: terms · สมัคร (ส่งแค่ `idCardLast4`) · OTP ถูก / ผิด (`attemptsLeft`) / ยืนยันซ้ำ · เครดิตแรกเข้า 10,000 + `initial_credit` 1 รายการ · อีเมลซ้ำ / รหัสอ่อน / เลขบัตรผิด checksum / ไม่ยอมรับข้อกำหนด · login ด้วย username และอีเมล · รหัสผิด `INVALID_CREDENTIALS` · ยืนยันอีเมลจากลิงก์ · sessions · เปลี่ยนรหัส (รหัสเดิมผิด / เหมือนเดิม / session อื่นหลุด) · forgot ไม่บอกว่ามีอีเมลหรือไม่ · logout แล้ว token ใช้ไม่ได้ · บัญชีถูกแบน login ได้ `ACCOUNT_BANNED`

#### เทสระบบลงสินค้าแบบ cross-test กับ PM
ผู้ขายที่สมัครจริงลงสินค้า → แอดมินอนุมัติ → 5.2 ของ Programmer เห็น `active` และไม่ส่ง `reservePrice` → บิด → ปิดประมูล → `order.create` สร้าง Order `pending_payment` ยอด 1,500 + ค่าส่ง 60 พร้อม snapshot ที่อยู่ → 8.2 ของ PM ผู้ชนะเห็น `canPay` → สินค้าย้ายไปแท็บ ended ใน 4.9 → ผู้ชนะได้แจ้งเตือน `AUCTION_WON` · ผ่านทั้งหมด

#### เทส Payment / Escrow / Shipping (ยอดเงินต้องตรง)
ตรวจทุกขั้นว่า **ยอดรวมทั้งระบบ = Wallet ทุกคน + เงินรอตรวจ + Escrow held + ค่าธรรมเนียม = 5 × 10,000 บาท คงที่ตลอด** และทุก Wallet `balance = ผลรวม wallet_transactions`

| Flow | ผล |
|---|---|
| ชนะประมูล 1,500 + ส่ง 60: จ่ายไม่แนบสลิป → `SLIP_REQUIRED` ไม่หักเงิน · จ่าย → หัก 1,560 · จ่ายซ้ำไม่หักซ้ำ · อนุมัติ → Escrow held 1,560 · ยืนยันรับก่อนส่งไม่ได้ · ส่ง → ยืนยันรับ → ค่าธรรมเนียม 75 (5% ของราคาปิด ไม่รวมค่าส่ง) ผู้ขายได้ 1,485 · **ผู้ซื้อจ่าย 1,560 = ผู้ขาย 1,485 + ค่าธรรมเนียม 75** · ยืนยันซ้ำไม่ปล่อยซ้ำ · 7.3 รายได้ผู้ขายตรง | ✅ |
| ซื้อทันที 300 + ส่ง 40: ปฏิเสธการชำระ → คืนเต็ม 340 · จ่ายใหม่ได้ · ส่งแล้วเปิดข้อพิพาท → ยืนยันรับไม่ได้ → ตัดสินคืนเงิน → ผู้ซื้อได้คืนเต็ม ผู้ขายไม่ได้ | ✅ |
| ราคา 300 → ค่าธรรมเนียมขั้นต่ำ 20 (5% = 15) ผู้ขายได้ 320 | ✅ |
| ราคา 15 → ค่าธรรมเนียม 15 (ไม่เกินราคาปิด) ผู้ขายได้แค่ค่าส่ง 40 · ปล่อยด้วย `autoRelease` เมื่อครบกำหนด | ✅ |
| ยกเลิกเพราะผู้ขายไม่ส่ง (8.6) → คืนเงิน + `penalty.add(no_shipment)` | ✅ (ชุดเทสจุดเชื่อม) |

#### บั๊กส่วน Auction
**ไม่พบบั๊ก** ทดสอบ 19 ข้อผ่านทั้งหมด: บิดต่ำกว่าราคาเริ่ม / ต่ำกว่าขั้นต่ำ (`minNextBid`) · เจ้าของบิดเอง / แอดมินบิด · ผู้นำบิดซ้ำ `ALREADY_LEADING` · Proxy บิดแทนทันที · D-13 ลดวงเงินไม่ได้ · D-14 วงเงินถึง Reserve ดันราคาไป Reserve · Proxy สองคน ราคา = อันดับ 2 + ขั้น · คนอื่นไม่เห็นวงเงิน Proxy (6.2, 5.2, 5.3) · Auto Extend ช่วงท้าย + เพดาน 10 ครั้ง · D-16 ผู้นำเพิ่มวงเงินไม่ต่อเวลา · D-15 Buy Now หายเมื่อราคาถึง · Buy Now ต้อง confirm / เจ้าของซื้อเองไม่ได้ · ปิด `has_winner` / `below_reserve` / `no_bid` · บิดหลังปิดไม่ได้ · 6.7 รายการที่ชนะ

#### เทสเมนูบัญชีแอดมิน (หลังปรับตามที่ผู้ใช้ขอ)
ผ่านทั้งหมด 7 ข้อ (Super Admin, จอ 1280 และ 375 px): sidebar ไม่มี "กลับหน้าเว็บ" / "ออกจากระบบ" แล้ว · คลิกอีเมลเปิดเมนู การแจ้งเตือน → `/pages/notifications.html`, ตั้งค่า → `/pages/settings.html`, ออกจากระบบ · คลิกที่อื่นหรือกด Esc แล้วเมนูปิด · กดออกจากระบบแล้ว token ใช้ไม่ได้ (401) · จอมือถือเมนูไม่ล้นจอ

#### ฝากปรับ / ส่งต่อให้เพื่อนแล้ว (เทสซ้ำเมื่อเพื่อนแก้เสร็จ)
| เรื่อง | เจ้าของ | เทสซ้ำอะไร |
|---|---|---|
| หน้าการแจ้งเตือน / ตั้งค่า แสดงในโครงหลังบ้านเมื่อเป็นแอดมิน | PM | แอดมินกด "การแจ้งเตือน" / "ตั้งค่า" / ปุ่มกระดิ่ง แล้วยังอยู่ในหลังบ้าน (sidebar + แถวบน) และยังไม่เห็นแท็บที่อยู่จัดส่ง / ตั้งค่าแจ้งเตือน · สมาชิกทั่วไปยังเห็นหน้าเดิม |
| login แล้ว admin / super_admin ไปหน้า dashboard และอ่าน `?next=` | SA | login ด้วย admin, superadmin → `/pages/admin/dashboard.html` · สมาชิกเปิดลิงก์ข้อพิพาทตอนยังไม่ login → login แล้วกลับหน้าเดิม · `?next=//evil.com` ต้องไม่พาออกนอกเว็บ · บัญชี `pending_verification` ยังไปหน้า OTP |
| เมนู "รอจัดส่ง" ใช้ sidebar ผู้ขาย | PM | ผู้ขายกด "รอจัดส่ง" แล้ว sidebar ด้านซ้ายยังเป็นเมนูผู้ขาย และเมนู "รอจัดส่ง" active |
| เมนู "การเงินผู้ขาย" | SA | ผู้ขายกดแล้วยังอยู่ในส่วนผู้ขาย ยอดรอรับและรายได้ตรงกับ 7.1 / 7.3 (ยอดเดียวกับที่เทสเงินไว้) ไม่มีปุ่มถอนเงิน |
| navbar ไม่ตัดบรรทัด | PM | บัญชีผู้ขายบนจอกว้างและจอแคบ เมนูอยู่บรรทัดเดียว / มือถือไม่ล้นจอ |
| รูปหลักฐานข้อพิพาท (404) | SA → QA | เมื่อ SA เพิ่ม API ใน spec แล้ว QA ทำ endpoint → ผู้ซื้อ / ผู้ขายของ Order และแอดมินเปิดรูปได้ คนอื่นได้ 404 |

#### วิธีทดสอบด้วยมือ (flow จริง ไม่ต้องใช้ SQL แล้ว)
1. `cd backend` → `npm run db:init` → `npm run dev` · ออก token `npm run dev:token -- <username>` แล้วใน DevTools: `localStorage.setItem('rakadee_token', '<token>')`
2. **เปิดร้าน:** buyer2 เปิด `/pages/seller/open-shop.html` ยื่น → admin เมนู "ตรวจร้านค้า" อนุมัติ / ไม่อนุมัติ
3. **ได้ Order:** seller1 ลงสินค้าที่มีราคาซื้อทันที → admin อนุมัติ → buyer1 กดซื้อทันที → ชำระที่ `/pages/payment.html?orderId=` (แนบสลิป) → admin เมนู "การเงิน" อนุมัติ → seller1 บันทึกจัดส่งในหน้าคำสั่งซื้อ
4. **ข้อพิพาท:** buyer1 หน้าคำสั่งซื้อ → "แจ้งปัญหา" → seller1 ส่งหลักฐานที่ `/pages/disputes.html?id=` → admin เมนู "ข้อพิพาท" เปลี่ยนสถานะ → ตัดสิน → ดูยอด Wallet
5. **บทลงโทษ / ผู้ใช้:** admin เมนู "ผู้ใช้" ระงับ / แบน / คืนสถานะ · ใช้ token superadmin ปลดแบน · แท็บ "บิดน่าสงสัย"
6. **ออกจากระบบ (แอดมิน):** คลิกอีเมลมุมขวาบน → "ออกจากระบบ"
