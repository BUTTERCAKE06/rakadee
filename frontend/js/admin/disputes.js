// admin/disputes.js — ตารางข้อพิพาท (api-spec 9.4) เจ้าของ: QA
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { status: 'active', q: '', page: 1 }; // ค่าเริ่มต้น: กำลังดำเนินการ (ยังไม่สิ้นสุด)

  async function load() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ page: state.page });
    if (state.status) params.set('status', state.status);
    if (state.q) params.set('q', state.q);
    try {
      const data = await api.get(`/admin/disputes?${params}`);
      if (!data.items.length) {
        rows.replaceChildren(el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'ไม่มีข้อพิพาท' })));
      } else {
        rows.replaceChildren(...data.items.map((d) => {
          const href = `/pages/admin/dispute-detail.html?id=${d.id}`;
          const tr = el('tr', { class: 'is-click' },
            el('td', {}, el('a', { href, text: qa.disputeCode(d.id) })),
            el('td', { text: qa.orderCode(d.orderId) }),
            el('td', { text: d.listingTitle }),
            el('td', { text: qa.DISPUTE_TYPE[d.type] || d.type }),
            el('td', {}, el('div', { text: `ผู้ซื้อ: ${d.buyer.displayName}` }), el('small', { class: 'muted', text: `ผู้ขาย: ${d.seller.displayName}` })),
            el('td', { text: qa.money(d.totalAmount) }),
            el('td', {}, qa.pill(qa.DISPUTE_STATUS, d.status)),
            el('td', { text: qa.dateTime(d.openedAt) }));
          tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = href; });
          return tr;
        }));
      }
      qa.pagination($('pagination'), data, (p) => { state.page = p; load(); });
    } catch (err) {
      rows.replaceChildren();
      qa.alertBox($('alert-area'), err.message);
    }
  }

  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!qa.requireAdmin(user)) return;
    $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.status = b.dataset.status;
      state.page = 1;
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    }));
    $('search-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.q = $('search-input').value.trim();
      state.page = 1;
      load();
    });
    load();
  });
})();
