// auction.routes.js — route ทั้งหมดของ Programmer (เจ้าของ: Programmer)
// mount ที่ /api ด้วยบรรทัดเดียวใน routes/index.js จึงไม่ต้องแก้ไฟล์ route ของโมดูลอื่น
//   5.1–5.4  หน้าแรก ค้นหา รายละเอียด ประวัติบิด   (public, ส่ง token มาได้เพื่อดู me / isMe)
//   5.5–5.7  Watchlist                            (member)
//   6.1–6.5  บิด, Proxy, Buy Now                  (member + สถานะบัญชีที่บิดได้ 'bid')
//   6.6–6.7  การประมูลของฉัน, รายการที่ชนะ         (member)
// GET /api/listings และ /api/listings/:id ไม่ชนกับ route ของ QA ใน listing.routes.js (QA ใช้ POST/PUT/DELETE เท่านั้น)
const express = require('express');
const { requireAuth, requireRole, requireActiveAccount } = require('../middlewares/auth');
const catalogCtrl = require('../controllers/catalog.controller');
const auctionCtrl = require('../controllers/auction.controller');
const watchlistCtrl = require('../controllers/watchlist.controller');

const router = express.Router();
const member = [requireAuth, requireRole('member')];
const bidder = [requireAuth, requireRole('member'), requireActiveAccount('bid')];

// 5. หน้าแรก ค้นหา รายละเอียด Watchlist
router.get('/home', catalogCtrl.home);                                 // 5.4
router.get('/listings', catalogCtrl.search);                           // 5.1
router.get('/listings/:id', catalogCtrl.detail);                       // 5.2
router.get('/listings/:id/bids', catalogCtrl.bidHistory);              // 5.3
router.get('/watchlist', ...member, watchlistCtrl.list);               // 5.5
router.post('/watchlist', ...member, watchlistCtrl.add);               // 5.6
router.delete('/watchlist/:listingId', ...member, watchlistCtrl.remove); // 5.7

// 6. Auction Engine
router.post('/listings/:id/bids', ...bidder, auctionCtrl.placeBid);    // 6.1
router.get('/listings/:id/proxy', ...member, auctionCtrl.getProxy);    // 6.2
router.put('/listings/:id/proxy', ...bidder, auctionCtrl.putProxy);    // 6.3 (ไม่มี DELETE ตาม D-13)
router.post('/listings/:id/buy-now', ...bidder, auctionCtrl.buyNow);   // 6.5
router.get('/me/bids', ...member, auctionCtrl.myBids);                 // 6.6
router.get('/me/won', ...member, auctionCtrl.myWon);                   // 6.7

module.exports = router;
