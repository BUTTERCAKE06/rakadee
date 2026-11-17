// หน้าโปรไฟล์ผู้ขายแบบสาธารณะ — API: GET /api/sellers/:userId (3.4 ของ QA)
// ได้ชื่อร้าน รายละเอียด จังหวัด วันที่เข้าร่วม และสินค้าที่กำลังประมูล (ListingCard)
(function () {
  'use strict';
  const A = window.Auction;
  const { h } = A;
  const sellerId = new URLSearchParams(location.search).get('id');

  async function init() {
    await A.clockReady; // รอเวลา server ก่อนคำนวณเวลาที่เหลือ
    const root = document.getElementById('profile-root');
    if (!sellerId) { root.replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: 'ไม่พบรหัสร้านค้า' })); return; }
    let p;
    try {
      p = await api.get(`/sellers/${encodeURIComponent(sellerId)}`);
    } catch (e) {
      root.replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: e.message }));
      return;
    }
    const name = p.shopName || p.displayName;
    document.title = `${name} - RAKADEE`;
    const avatar = A.safeImageUrl(p.avatarUrl);
    const joined = p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : '-';
    const listings = (p.activeListings || []).map(A.normalizeCard);
    root.replaceChildren(
      h('section', { class: 'card au-profile-head' },
        avatar ? h('img', { class: 'au-avatar', src: avatar, alt: '' })
          : h('div', { class: 'au-avatar', 'aria-hidden': 'true', text: Array.from(name.replace(/^ร้าน/, ''))[0] || '?' }),
        h('div', { class: 'au-grow' },
          h('h1', { text: name }),
          p.shopDescription && h('p', { text: p.shopDescription }),
          h('div', { class: 'au-label', text: `${p.originProvince || '-'} · เข้าร่วมเมื่อ ${joined}` })),
        h('div', { class: 'au-stats' },
          h('div', null, h('strong', { text: String(listings.length) }), h('span', { text: 'สินค้ากำลังประมูล' })))),
      h('div', { class: 'au-section-head' }, h('h2', { text: 'สินค้ากำลังประมูลของร้าน' })),
      listings.length
        ? h('div', { class: 'au-grid' }, listings.map((it) => A.buildAuctionCard(it)))
        : h('div', { class: 'au-empty', text: 'ร้านนี้ยังไม่มีสินค้ากำลังประมูล' }));
    A.startTicker();
  }
  init();
})();
