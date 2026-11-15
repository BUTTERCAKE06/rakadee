# เอกสาร QA (เจ้าของ: QA)

| ไฟล์ | เนื้อหา | สถานะ |
| --- | --- | --- |
| `test-plan-and-test-cases.pdf` | Test Plan + Test Case 94 เคส (11 โมดูล) | ใช้ได้ ต้องปรับบางเคสตามรายการด้านล่าง |
| `review-erd-api-spec.pdf` | รายงาน Review ERD และ API Spec ฉบับแรกของ SA (52 ข้อสังเกต) | ปิดครบแล้วใน `docs/erd/schema.sql`, `docs/api-spec/api-spec.md` และ D-07 ถึง D-12 |

## Test Case ที่ต้องปรับให้ตรงกับ ERD / API Spec ฉบับใหม่

| Test Case | เหตุผล | ปรับเป็น |
| --- | --- | --- |
| TC-16, TC-17 | ทดสอบ KYC ซึ่งตัดออกแล้ว (D-07, D-09) | เปลี่ยนเป็นทดสอบเข้ารหัสเลขบัตรตอนสมัคร (API ส่งแค่ `idCardLast4`) และยืนยันอีเมลด้วยลิงก์ (API 1.8) |
| TC-21 | เปิดร้านต้องผ่าน KYC และกรอกบัญชีธนาคาร | เปิดร้านได้ทันทีเมื่อบัญชี active (API 3.1) ทดสอบ `pending_verification`/`restricted` ถูกปฏิเสธ และ `ALREADY_SELLER` |
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

## ปัญหา
สาเหตุ กดแก้ไขสินค้า แล้วข้อมูลที่ควรมีไม่ขึ้น เพราะต้องใช้ API ของ Programmer
5.2	GET	/api/listings/:id	public	รายละเอียดสินค้า 