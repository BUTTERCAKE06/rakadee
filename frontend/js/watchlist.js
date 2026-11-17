// หน้า Watchlist (ข้อ 1.5-3) — API: GET /api/watchlist (5.5), DELETE /api/watchlist/:listingId (5.7 ผ่านปุ่มหัวใจ)
(function () {
  'use strict';
  const A = window.Auction;
  const grid = document.getElementById('grid');
  const msg = document.getElementById('msg');

  async function init() {
    await A.clockReady; // รอเวลา server ก่อนคำนวณเวลาที่เหลือ
    const user = await A.whenUserReady();
    if (!user) { A.showAlert(msg, 'error', 'กรุณาเข้าสู่ระบบเพื่อดู Watchlist'); return; }
    try {
      const data = await api.get('/watchlist');
      const items = data.items.map(A.normalizeCard);
      // กดหัวใจออก = เอาการ์ดออกจากหน้า
      const opts = { watched: true, onWatchChange: (it, on) => { if (!on) grid.querySelector(`a[href$="id=${it.id}"]`)?.closest('.au-card')?.remove(); if (!grid.children.length) A.renderCards(grid, [], 'ยังไม่มีสินค้าใน Watchlist กดหัวใจที่การ์ดสินค้าเพื่อติดตาม'); } };
      A.renderCards(grid, items, 'ยังไม่มีสินค้าใน Watchlist กดหัวใจที่การ์ดสินค้าเพื่อติดตาม', opts);
    } catch (e) {
      A.showAlert(msg, 'error', e.message);
    }
    A.startTicker();
  }
  init();
})();
