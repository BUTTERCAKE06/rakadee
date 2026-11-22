// รายการรอจัดส่งของผู้ขาย (api-spec 8.3, requirement 6.5) — เจ้าของ: PM
// เรียงใกล้ครบกำหนดก่อน เวลาคงเหลือนับจาก server (remainingSec + serverTime)
(() => {
  const { h, baht, when, code } = window.OrderView;
  const $ = (id) => document.getElementById(id);
  let offset = 0;

  function remaining(dueIso) {
    const sec = Math.floor((new Date(dueIso).getTime() - (Date.now() + offset)) / 1000);
    if (sec <= 0) return h('span', { class: 'overdue', text: 'เลยกำหนดแล้ว' });
    const d = Math.floor(sec / 86400);
    const hh = Math.floor((sec % 86400) / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const text = d ? `เหลือ ${d} วัน ${hh} ชม.` : `เหลือ ${hh} ชม. ${mm} นาที`;
    return h('span', { class: sec < 24 * 3600 ? 'overdue' : '', text });
  }

  function render(d) {
    offset = new Date(d.serverTime).getTime() - Date.now();
    const rows = $('rows');
    if (!d.items.length) {
      rows.replaceChildren(h('tr', null, h('td', { colspan: '7', class: 'muted', style: 'text-align:center;padding:32px', text: 'ไม่มีรายการที่ต้องจัดส่ง' })));
      return;
    }
    rows.replaceChildren(...d.items.map((s) => {
      const r = s.recipient || {};
      return h('tr', null,
        h('td', null, h('a', { href: `/pages/orders.html?id=${s.orderId}`, text: code(s.orderId) }),
          s.disputeStatus && s.disputeStatus !== 'closed' ? h('div', null, h('span', { class: 'badge badge-danger', text: 'มีข้อพิพาท' })) : null),
        h('td', null, s.listingTitle, h('div', { class: 'muted', text: s.closingType === 'buy_now' ? 'ซื้อทันที' : 'ประมูล' })),
        h('td', { text: when(s.paidAt) }),
        h('td', null, when(s.shipDueAt), h('div', null, remaining(s.shipDueAt))),
        h('td', null, `${r.recipientName || '-'} · ${r.phone || ''}`,
          h('div', { class: 'muted', text: [r.addressLine, r.subDistrict, r.district, r.province, r.postalCode].filter(Boolean).join(' ') })),
        h('td', { text: s.shippingFee ? baht(s.shippingFee) : 'ส่งฟรี' }),
        h('td', null, h('a', { class: 'btn btn-primary', href: `/pages/orders.html?id=${s.orderId}#ship`, text: 'บันทึกการจัดส่ง' })));
    }));
  }

  async function load() {
    try {
      render(await api.get('/seller/shipments'));
      $('alert').replaceChildren();
    } catch (e) {
      $('alert').replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: e.message }));
    }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname)}`; return; }
    if (u.role !== 'seller') {
      $('alert').replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: 'หน้านี้สำหรับผู้ขายเท่านั้น' }));
      return;
    }
    load();
    setInterval(load, 60 * 1000);
  });
})();
