// หน้า "การประมูลของฉัน" — API: GET /api/me/bids (6.6)
// แท็บ: กำลังนำ / ถูกแซง (status=active ตาม isLeading) และ ชนะ / แพ้ (status=ended ตาม won)
(function () {
  'use strict';
  const A = window.Auction;
  const { h } = A;
  const rows = document.getElementById('rows');
  const tabsEl = document.getElementById('tabs');
  const msg = document.getElementById('msg');

  const TABS = [
    { id: 'leading', label: 'กำลังนำ', test: (b) => b.status === 'active' && b.isLeading, badge: ['badge-success', 'กำลังนำ'] },
    { id: 'outbid', label: 'ถูกแซง', test: (b) => b.status === 'active' && !b.isLeading, badge: ['badge-danger', 'ถูกแซง'] },
    { id: 'won', label: 'ชนะ', test: (b) => b.status === 'ended' && b.won, badge: ['badge-success', 'ชนะ'] },
    { id: 'lost', label: 'แพ้', test: (b) => b.status === 'ended' && !b.won, badge: ['', 'แพ้'] },
  ];
  let items = [];
  let current = 'leading';

  function row(b, tab) {
    const card = A.normalizeCard(b);
    const img = A.safeImageUrl(card.coverUrl);
    return h('tr', null,
      h('td', null, h('a', { class: 'au-row-item', href: A.listingUrl(b.id) },
        img ? h('img', { class: 'au-thumb-sm', src: img, alt: '' }) : h('div', { class: 'au-thumb-sm', 'aria-hidden': 'true' }),
        h('span', { text: b.title }))),
      h('td', { text: A.formatMoney(card.displayPrice) }),
      h('td', { text: A.formatMoney(A.moneyToSatang(b.myHighestBid)) }),
      h('td', null, h('span', { class: `badge ${tab.badge[0]}`, text: tab.badge[1] })),
      h('td', null, b.status === 'active' ? A.timeBadge(card.endAt, { precise: true }) : h('span', { class: 'muted', text: 'ปิดแล้ว' })));
  }

  function render() {
    const tab = TABS.find((t) => t.id === current);
    tabsEl.replaceChildren(...TABS.map((t) => {
      const btn = h('button', { type: 'button', role: 'tab', 'aria-selected': t.id === current ? 'true' : 'false', text: `${t.label} (${items.filter(t.test).length})` });
      btn.addEventListener('click', () => { current = t.id; render(); });
      return btn;
    }));
    const list = items.filter(tab.test);
    rows.replaceChildren(...(list.length ? list.map((b) => row(b, tab))
      : [h('tr', null, h('td', { colspan: '5', class: 'muted', text: 'ไม่มีรายการในแท็บนี้' }))]));
  }

  async function init() {
    await A.clockReady; // รอเวลา server ก่อนคำนวณเวลาที่เหลือ
    const user = await A.whenUserReady();
    if (!user) { A.showAlert(msg, 'error', 'กรุณาเข้าสู่ระบบเพื่อดูการประมูลของคุณ'); return; }
    try {
      items = (await api.get('/me/bids')).items;
      render();
    } catch (e) {
      A.showAlert(msg, 'error', e.message);
    }
    A.startTicker();
  }
  init();
})();
