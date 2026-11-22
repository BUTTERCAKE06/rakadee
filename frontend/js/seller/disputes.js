// seller/disputes.js — รายการข้อพิพาทของผู้ขาย (GET /api/disputes?role=seller) เจ้าของ: QA
// กดแถวเพื่อไปหน้าข้อพิพาท (ส่งหลักฐานฝั่งผู้ขาย): /pages/disputes.html?id=<id>
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { status: 'active', page: 1 };

  async function load() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 7, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ role: 'seller', page: state.page });
    if (state.status) params.set('status', state.status);
    try {
      const data = await api.get(`/disputes?${params}`);
      rows.replaceChildren(...(data.items.length ? data.items.map((d) => {
        const href = `/pages/disputes.html?id=${d.id}`;
        // ยังไม่ปิดและยังไม่ส่งหลักฐาน = ต้องทำ
        const needEvidence = d.status !== 'closed' && d.sellerEvidenceCount === 0;
        const tr = el('tr', { class: 'is-click' },
          el('td', {}, el('a', { href, text: qa.disputeCode(d.id) }), el('div', {}, el('small', { class: 'muted', text: qa.orderCode(d.orderId) }))),
          el('td', {}, el('span', { class: 'qa-cover-cell' },
            d.coverUrl ? el('img', { class: 'qa-cover-sm', src: d.coverUrl, alt: '' }) : el('span', { class: 'qa-cover-sm', text: '🖼' }),
            el('span', { class: 'qa-ellipsis', title: d.listingTitle, text: d.listingTitle }))),
          el('td', { text: qa.DISPUTE_TYPE[d.type] || d.type }),
          el('td', { text: d.counterparty }),
          el('td', {}, qa.pill(qa.DISPUTE_STATUS_SELLER, d.status),
            d.resolution ? el('div', {}, el('small', { class: 'muted', text: qa.RESOLUTION[d.resolution] })) : ''),
          el('td', { text: qa.date(d.openedAt) }),
          el('td', {}, el('a', { class: `btn btn-sm ${needEvidence ? 'btn-navy' : 'btn-outline-navy'}`, href, text: needEvidence ? 'ส่งหลักฐาน' : 'ดู' })));
        tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = href; });
        return tr;
      }) : [el('tr', {}, el('td', { colspan: 7, class: 'empty', text: state.status === 'active' ? 'ไม่มีข้อพิพาทที่กำลังดำเนินการ' : 'ไม่มีข้อพิพาท' }))]));
      qa.pagination($('pagination'), data, (p) => { state.page = p; load(); });
    } catch (err) {
      rows.replaceChildren();
      qa.alertBox($('alert-area'), err.message);
    }
  }

  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!user) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (user.role !== 'seller') { location.href = '/pages/seller/open-shop.html'; return; }
    $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.status = b.dataset.status;
      state.page = 1;
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    }));
    load();
  });
})();
