// หน้ารายการที่ชนะ — API: GET /api/me/won (6.7)
// ปุ่มไปหน้าคำสั่งซื้อ (หน้าชำระเงินเป็นงานของ SA ใน Phase 2)
(function () {
  'use strict';
  const A = window.Auction;
  const { h } = A;
  const rows = document.getElementById('rows');
  const msg = document.getElementById('msg');

  // orders.status ตาม schema.sql (ข้อ 1.7-3)
  const ORDER_STATUS = {
    pending_payment: ['badge-warning', 'รอการชำระเงิน'],
    awaiting_shipment: ['badge-success', 'รอการจัดส่ง'],
    shipped: ['badge-success', 'จัดส่งแล้ว'],
    completed: ['badge-success', 'เสร็จสมบูรณ์'],
    disputed: ['badge-danger', 'มีข้อพิพาท'],
    cancelled: ['', 'ยกเลิก'],
  };
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

  function row(w) {
    const [cls, text] = ORDER_STATUS[w.orderStatus] || ['', w.orderStatus];
    const img = A.safeImageUrl(w.coverUrl);
    return h('tr', null,
      h('td', null, h('a', { class: 'au-row-item', href: A.listingUrl(w.listingId) },
        img ? h('img', { class: 'au-thumb-sm', src: img, alt: '' }) : h('div', { class: 'au-thumb-sm', 'aria-hidden': 'true' }),
        h('span', { text: w.title }))),
      h('td', { text: A.formatMoney(A.moneyToSatang(w.price)) }),
      h('td', { text: w.orderStatus === 'pending_payment' ? fmtDate(w.paymentDueAt) : '-' }),
      h('td', null, h('span', { class: `badge ${cls}`, text })),
      h('td', null, h('a', { class: `btn ${w.orderStatus === 'pending_payment' ? 'btn-primary' : ''}`,
        href: w.orderStatus === 'pending_payment' ? `/pages/payment.html?orderId=${w.orderId}` : '/pages/orders.html',
        text: w.orderStatus === 'pending_payment' ? 'ชำระเงิน' : 'ดูคำสั่งซื้อ' })));
  }

  async function init() {
    const user = await A.whenUserReady();
    if (!user) { A.showAlert(msg, 'error', 'กรุณาเข้าสู่ระบบเพื่อดูรายการที่ชนะ'); return; }
    try {
      const { items } = await api.get('/me/won');
      rows.replaceChildren(...(items.length ? items.map(row)
        : [h('tr', null, h('td', { colspan: '5', class: 'muted', text: 'ยังไม่มีรายการที่ชนะ' }))]));
    } catch (e) {
      A.showAlert(msg, 'error', e.message);
    }
  }
  init();
})();
