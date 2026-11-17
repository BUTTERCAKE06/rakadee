// หน้าแรก (ข้อ 1.5-2, 3.5): หมวดหมู่ + ใกล้จบการประมูล + มาใหม่ล่าสุด
// API: GET /api/home (5.4), GET /api/categories (4.1 ของ QA), GET /api/watchlist (5.5 ถ้า login ไว้ใช้ทำหัวใจ)
(function () {
  'use strict';
  const A = window.Auction;
  const { h } = A;

  async function watchedIds() {
    const user = await A.whenUserReady();
    if (!user || !['bidder', 'seller'].includes(user.role)) return new Set();
    try {
      const data = await api.get('/watchlist');
      return new Set(data.items.map((i) => String(i.id)));
    } catch {
      return new Set(); // หัวใจแสดงว่างไว้ก่อน ไม่ทำให้หน้าพัง
    }
  }

  async function renderCategories() {
    const box = document.getElementById('cats');
    try {
      const res = await api.get('/categories'); // QA ตอบ { items: [...] }
      const cats = Array.isArray(res) ? res : (res && res.items) || [];
      box.replaceChildren(...cats.map((c) =>
        h('a', { class: 'au-cat', href: `/pages/search.html?categoryId=${encodeURIComponent(c.id)}` },
          h('span', { class: 'au-cat-icon', 'aria-hidden': 'true' }),
          h('span', { text: c.name }))));
    } catch (e) {
      A.showAlert(box, 'error', e.message);
    }
  }

  async function init() {
    await A.clockReady; // รอเวลา server ก่อนคำนวณเวลาที่เหลือ
    renderCategories();
    const ending = document.getElementById('ending');
    const newest = document.getElementById('newest');
    try {
      const [data, watched] = await Promise.all([api.get('/home'), watchedIds()]);
      const card = (c) => ({ watched: watched.has(String(c.id)) });
      const ends = data.endingSoon.map(A.normalizeCard);
      const news = data.newest.map(A.normalizeCard);
      ending.replaceChildren(...(ends.length ? ends.map((it) => A.buildAuctionCard(it, card(it))) : [h('p', { class: 'muted', text: 'ยังไม่มีสินค้าที่กำลังประมูล' })]));
      newest.replaceChildren(...(news.length ? news.map((it) => A.buildAuctionCard(it, card(it))) : [h('p', { class: 'muted', text: 'ยังไม่มีสินค้าใหม่' })]));
    } catch (e) {
      A.showAlert(ending, 'error', e.message);
      newest.replaceChildren();
    }
    A.startTicker();
  }
  init();
})();