// Scheduler detectShill (เจ้าของ: QA) — requirement 7.3-2, api-spec 10 Scheduler
// บันทึก suspicious_flags ให้แอดมินตรวจ (ไม่ลงโทษอัตโนมัติ):
//   same_ip          ผู้บิดใช้ IP เดียวกับ session ใดๆ ของผู้ขายเจ้าของสินค้า
//   repeated_seller  ผู้บิดบิดสินค้าของผู้ขายคนเดิม ≥ SHILL_MIN_LISTINGS รายการภายในช่วง SHILL_WINDOW
// ไม่สร้าง flag ซ้ำสำหรับ (listing, bidder, reason) เดียวกัน
// ทำเป็น job แทนการตรวจตอนบิด เพื่อไม่แตะโค้ด Auction Engine ของ Programmer
//
// หมายเหตุ: ช่วงเวลา 7 วันควรอยู่ใน config/time.js (เจ้าของ PM) — ใช้ time.shillWindowMs ถ้ามี
//           ระหว่างรอ PM เพิ่ม ใช้ค่าตาม api-spec 10 (7 วัน) เป็นค่าสำรอง
const db = require('../config/db');
const time = require('../config/time');

const SHILL_WINDOW_MS = time.shillWindowMs; // api-spec 10: "ภายใน 7 วัน" (config/time.js)
const SHILL_MIN_LISTINGS = 5; // api-spec 10: "≥ 5 รายการ"

module.exports = {
  name: 'detectShill',
  run: async () => {
    const since = new Date(Date.now() - SHILL_WINDOW_MS);

    // 1) same_ip — bid ที่ IP ตรงกับ session ของผู้ขาย
    const [ipRes] = await db.pool.query(
      `INSERT INTO suspicious_flags (listing_id, bidder_id, seller_id, reason, detail)
       SELECT DISTINCT b.listing_id, b.bidder_id, l.seller_id, 'same_ip', CONCAT('IP ', b.ip_address)
         FROM bids b
         JOIN listings l ON l.id = b.listing_id
         JOIN sessions s ON s.user_id = l.seller_id AND s.ip_address = b.ip_address
        WHERE b.created_at >= ?
          AND b.ip_address IS NOT NULL
          AND b.bidder_id <> l.seller_id
          AND NOT EXISTS (SELECT 1 FROM suspicious_flags f
                           WHERE f.listing_id = b.listing_id AND f.bidder_id = b.bidder_id AND f.reason = 'same_ip')`,
      [since],
    );

    // 2) repeated_seller — บิดร้านเดิม ≥ N รายการในช่วงเวลา (flag ทุก listing ของคู่นั้นที่ยังไม่มี flag)
    const [repRes] = await db.pool.query(
      `INSERT INTO suspicious_flags (listing_id, bidder_id, seller_id, reason, detail)
       SELECT DISTINCT b.listing_id, b.bidder_id, l.seller_id, 'repeated_seller',
              CONCAT('บิดสินค้าร้านนี้ ', pair.listing_count, ' รายการในช่วงที่ตรวจ')
         FROM bids b
         JOIN listings l ON l.id = b.listing_id
         JOIN (SELECT b2.bidder_id, l2.seller_id, COUNT(DISTINCT b2.listing_id) AS listing_count
                 FROM bids b2 JOIN listings l2 ON l2.id = b2.listing_id
                WHERE b2.created_at >= ?
                GROUP BY b2.bidder_id, l2.seller_id
               HAVING COUNT(DISTINCT b2.listing_id) >= ?) pair
           ON pair.bidder_id = b.bidder_id AND pair.seller_id = l.seller_id
        WHERE b.created_at >= ?
          AND NOT EXISTS (SELECT 1 FROM suspicious_flags f
                           WHERE f.listing_id = b.listing_id AND f.bidder_id = b.bidder_id AND f.reason = 'repeated_seller')`,
      [since, SHILL_MIN_LISTINGS, since],
    );

    const total = ipRes.affectedRows + repRes.affectedRows;
    if (total) console.log(`[job:detectShill] new flags: same_ip=${ipRes.affectedRows}, repeated_seller=${repRes.affectedRows}`);
  },
};
