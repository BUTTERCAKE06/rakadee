// seller/dashboard.js — แดชบอร์ดผู้ขาย (ภาพ UI 28) เจ้าของ: QA
// แหล่งข้อมูล:
//   สินค้ารออนุมัติ / กำลังประมูล + ตารางกำลังประมูล → 4.9 GET /seller/listings (QA, มีแล้ว)
//   รอจัดส่ง + ตารางรอจัดส่ง → 8.3 GET /seller/shipments (PM)
//   เงินรอรับ (Escrow)       → 7.1 GET /wallet ฟิลด์ pendingIncome (SA)
//   รายได้สุทธิ              → 7.3 GET /seller/earnings totals.released (SA)
// ถ้า API ไหนเรียกไม่สำเร็จ จะแสดง "—" พร้อมบอกเจ้าของ API (หน้าอื่นยังใช้ได้)
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  let serverOffset = 0; // เวลา server − เวลาเครื่อง (countdown ใช้เวลา server)

  const now = () => Date.now() + serverOffset;
  function remainText(endIso) {
    const sec = Math.max(0, Math.floor((new Date(endIso).getTime() - now()) / 1000));
    if (sec <= 0) return 'หมดเวลา';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d) return `${d} วัน ${h} ชม.`;
    if (h) return `${h} ชม. ${m} นาที`;
    return `${m} นาที`;
  }
  const cover = (url) => (url ? el('img', { class: 'qa-cover-sm', src: url, alt: '' }) : el('span', { class: 'qa-cover-sm', text: '🖼' }));

  function setPending(id, subId, reason) {
    $(id).textContent = '—';
    const sub = $(subId);
    sub.textContent = reason;
    sub.classList.add('is-pending');
  }

  // API ที่ยังไม่มี: route ไม่มี → NOT_FOUND
  async function optional(path) {
    try { return { data: await api.get(path) }; } catch (err) { return { error: err }; }
  }

  async function loadListings() {
    const [pending, active] = await Promise.all([
      api.get('/seller/listings?status=pending_review&limit=1'),
      api.get('/seller/listings?status=active&limit=50'),
    ]);
    $('st-pending').textContent = pending.total;
    $('st-active').textContent = active.total;
    const sum = active.items.reduce((s, l) => s + Number(l.currentPrice ?? l.startPrice ?? 0), 0);
    $('st-active-sub').textContent = `ราคารวม ${qa.money(sum)}`;

    const items = [...active.items].sort((a, b) => new Date(a.endAt) - new Date(b.endAt));
    $('active-rows').replaceChildren(...(items.length ? items.map((l) => el('tr', {},
      el('td', {}, el('a', { class: 'qa-cover-cell', href: `/pages/listing.html?id=${l.id}`, style: 'color:inherit;' }, cover(l.coverUrl), l.title)),
      el('td', { text: qa.money(l.currentPrice ?? l.startPrice) }),
      el('td', { text: l.bidCount }),
      el('td', { text: l.endAt ? remainText(l.endAt) : '-' })))
      : [el('tr', {}, el('td', { colspan: 4, class: 'empty', text: 'ยังไม่มีสินค้าที่กำลังประมูล' }))]));
  }

  async function loadShipments() {
    const r = await optional('/seller/shipments');
    if (r.error) {
      setPending('st-ship', 'st-ship-sub', 'รอ API 8.3 (PM)');
      $('ship-rows').replaceChildren(el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'ยังแสดงไม่ได้ — รอระบบจัดส่งของ PM (API 8.3)' })));
      return;
    }
    const items = r.data.items || [];
    $('st-ship').textContent = items.length;
    $('ship-rows').replaceChildren(...(items.length ? items.slice(0, 5).map((s) => {
      const hours = s.remainingSec / 3600;
      const cls = hours <= 24 ? 'is-danger' : 'is-warning';
      return el('tr', {},
        el('td', { text: qa.orderCode(s.orderId) }),
        el('td', {}, el('span', { class: 'qa-cover-cell' }, cover(null), s.listingTitle)),
        el('td', { text: (s.recipient && s.recipient.recipientName) || '-' }),
        el('td', {}, el('span', { class: `qa-pill ${cls}`, text: `เหลือ ${remainText(new Date(now() + s.remainingSec * 1000).toISOString())}` })),
        el('td', {}, el('span', { class: 'btn btn-sm btn-navy', title: 'หน้าบันทึกจัดส่งเป็นงานของ PM', text: 'บันทึกจัดส่ง' })));
    }) : [el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'ไม่มีรายการรอจัดส่ง' }))]));
  }

  async function loadMoney() {
    const [wallet, earnings] = await Promise.all([optional('/wallet'), optional('/seller/earnings')]);
    if (wallet.data && wallet.data.pendingIncome !== undefined) $('st-escrow').textContent = qa.money(wallet.data.pendingIncome);
    else setPending('st-escrow', 'st-escrow-sub', 'รอ API 7.1 pendingIncome (SA)');
    if (earnings.data && earnings.data.totals) $('st-net').textContent = qa.money(earnings.data.totals.released);
    else setPending('st-net', 'st-net-sub', 'รอ API 7.3 (SA)');
  }

  document.addEventListener('user:ready', async (e) => {
    const user = e.detail;
    if (!user) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (user.role !== 'seller') { location.href = '/pages/seller/open-shop.html'; return; }
    try {
      const h = await api.get('/health');
      serverOffset = new Date(h.serverTime).getTime() - Date.now();
    } catch { /* ใช้เวลาเครื่องแทน */ }
    try {
      await Promise.all([loadListings(), loadShipments(), loadMoney()]);
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
  });
})();
