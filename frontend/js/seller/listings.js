// seller/listings.js — สินค้าของฉัน (ภาพ UI 29, api-spec 4.9) เจ้าของ: QA
// ยกเลิกสินค้า (4.8) ย้ายไปอยู่ในหน้าแก้ไขสินค้า (ภาพไม่มีปุ่มยกเลิกในตาราง)
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { status: '', page: 1 };

  const STATUS = {
    draft: ['ฉบับร่าง', ''],
    pending_review: ['รอตรวจสอบ', 'is-warning'],
    rejected: ['ไม่อนุมัติ', 'is-danger'],
    active: ['กำลังประมูล', 'is-success'],
    ended: ['สิ้นสุด', 'is-info'],
    cancelled: ['ยกเลิก', ''],
  };

  function action(l) {
    const edit = (text) => el('a', { class: 'btn btn-sm btn-outline-navy', href: `/pages/seller/listing-form.html?id=${l.id}`, text });
    if (l.status === 'draft' || l.status === 'pending_review') return edit('แก้ไข');
    if (l.status === 'rejected') return edit('แก้ไขและส่งใหม่');
    if (l.status === 'active') return el('span', { class: 'muted', style: 'font-size:13px;', text: 'ล็อกการแก้ไข' });
    if (l.status === 'ended') return el('a', { class: 'btn btn-sm', href: `/pages/listing.html?id=${l.id}`, text: 'ดูผล' });
    return el('span', { class: 'muted', text: '—' });
  }

  async function load() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ page: state.page });
    if (state.status) params.set('status', state.status);
    try {
      const data = await api.get(`/seller/listings?${params}`);

      // แถบเหตุผลที่ไม่อนุมัติ (แสดงทุกสินค้าที่ไม่อนุมัติในหน้านี้)
      const rejected = data.items.filter((l) => l.status === 'rejected' && l.rejectReason);
      $('banners').replaceChildren(...rejected.map((l) => el('div', { class: 'qa-banner-danger', role: 'alert' },
        el('span', { 'aria-hidden': 'true', text: '⚠' }),
        el('span', {}, el('strong', { text: 'เหตุผลที่ไม่อนุมัติ: ' }), l.rejectReason,
          rejected.length > 1 ? el('span', { class: 'muted', text: ` (${l.title})` }) : ''))));

      rows.replaceChildren(...(data.items.length ? data.items.map((l) => el('tr', {},
        el('td', {}, el('span', { class: 'qa-cover-cell' },
          l.coverUrl ? el('img', { class: 'qa-cover-sm', src: l.coverUrl, alt: '' }) : el('span', { class: 'qa-cover-sm', text: '🖼' }),
          el('strong', { text: l.title }))),
        el('td', { text: qa.money(l.startPrice) }),
        el('td', { text: l.durationDays ? `${l.durationDays} วัน` : '-' }),
        el('td', {}, qa.pill(STATUS, l.status)),
        el('td', {}, action(l))))
        : [el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'ยังไม่มีสินค้าในสถานะนี้' }))]));
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
    const msg = qa.qs('msg');
    if (msg === 'submitted') qa.alertBox($('alert-area'), 'ส่งตรวจเรียบร้อยแล้ว รอแอดมินอนุมัติ', 'success');
    if (msg === 'saved') qa.alertBox($('alert-area'), 'บันทึกร่างเรียบร้อยแล้ว', 'success');
    if (msg === 'cancelled') qa.alertBox($('alert-area'), 'ยกเลิกสินค้าแล้ว', 'success');
    $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.status = b.dataset.status;
      state.page = 1;
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    }));
    load();
  });
})();
