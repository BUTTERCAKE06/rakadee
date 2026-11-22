// admin/seller-applications.js — รายการคำขอเปิดร้าน (api-spec 3.5, D-18) เจ้าของ: QA
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { status: 'pending', q: '', page: 1 };

  const yesNo = (ok, label) => el('span', { class: ok ? 'badge-verified' : 'hint', text: `${label} ${ok ? '✓' : '✗'}` });

  async function load() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ status: state.status, page: state.page });
    if (state.q) params.set('q', state.q);
    try {
      const data = await api.get(`/admin/seller-applications?${params}`);
      if (!data.items.length) {
        rows.replaceChildren(el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'ไม่มีคำขอในสถานะนี้' })));
      } else {
        rows.replaceChildren(...data.items.map((r) => {
          const href = `/pages/admin/seller-application.html?userId=${r.userId}`;
          const tr = el('tr', { class: 'is-click' },
            el('td', {}, el('strong', { text: r.shopName })),
            el('td', {}, el('div', { text: r.displayName }), el('small', { class: 'muted', text: `@${r.username}` })),
            el('td', { text: r.originProvince }),
            el('td', {}, yesNo(r.emailVerified, 'อีเมล'), ' ', yesNo(r.phoneVerified, 'เบอร์')),
            el('td', { text: `${r.accountAgeDays} วัน` }),
            el('td', {}, r.penaltyCount ? el('span', { class: 'qa-pill is-danger', text: `${r.penaltyCount} ครั้ง` }) : el('span', { class: 'muted', text: '-' })),
            el('td', { text: qa.dateTime(r.submittedAt) }),
            el('td', {}, el('a', { class: 'btn btn-primary', href, text: state.status === 'pending' ? 'ตรวจสอบ' : 'ดู' })));
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
    const initial = qa.qs('status');
    if (['pending', 'approved', 'rejected'].includes(initial)) state.status = initial;
    $('tabs').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.status === state.status);
      b.addEventListener('click', () => {
        state.status = b.dataset.status;
        state.page = 1;
        $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        load();
      });
    });
    $('search-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.q = $('search-input').value.trim();
      state.page = 1;
      load();
    });
    load();
  });
})();
