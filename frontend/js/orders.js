// คำสั่งซื้อของฉัน (api-spec 8.1) + รายละเอียด ?id= (8.2 ผ่าน order-view.js) — เจ้าของ: PM
// ผู้ขายสลับดู "ที่ฉันขาย" ได้ (?role=seller)
(() => {
  const { h, statusBadge, thumb, baht, when, code } = window.OrderView;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const STATUS_TABS = [
    ['', 'ทั้งหมด'], ['pending_payment', 'รอชำระ'], ['awaiting_shipment', 'รอจัดส่ง'], ['shipped', 'กำลังจัดส่ง'],
    ['completed', 'สำเร็จ'], ['disputed', 'ข้อพิพาท'], ['cancelled', 'ยกเลิก'],
  ];
  const state = { role: params.get('role') === 'seller' ? 'seller' : 'buyer', status: params.get('status') || '', page: 1 };

  // ข้อความสั้นใต้ชื่อสินค้า บอกว่าต้องทำอะไรต่อ
  function hint(o) {
    const me = state.role;
    if (o.status === 'pending_payment') {
      if (o.paymentStatus === 'pending_review') return 'รอแอดมินตรวจการชำระเงิน';
      return me === 'buyer' ? `ชำระภายใน ${when(o.paymentDueAt)}` : 'รอผู้ซื้อชำระเงิน';
    }
    if (o.status === 'awaiting_shipment') {
      const late = o.shipDueAt && new Date(o.shipDueAt) < new Date();
      if (me === 'seller') return late ? 'เลยกำหนดส่งแล้ว' : `ส่งภายใน ${when(o.shipDueAt)}`;
      return late ? 'ผู้ขายเลยกำหนดส่ง ขอยกเลิกได้' : 'รอผู้ขายจัดส่ง';
    }
    if (o.status === 'shipped') return me === 'buyer' ? 'ได้รับของแล้วกดยืนยันรับ' : 'รอผู้ซื้อยืนยันรับ';
    return '';
  }

  function renderTabs(counts) {
    const host = $('status-tabs');
    host.replaceChildren(...STATUS_TABS.map(([s, label]) => {
      const n = s ? (counts[s] || 0) : Object.values(counts).reduce((a, b) => a + b, 0);
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(state.status === s) }, label,
        n ? h('span', { class: 'tab-count', text: n }) : null);
      b.addEventListener('click', () => { state.status = s; state.page = 1; load(); });
      return b;
    }));
  }

  function renderList(d) {
    renderTabs(d.counts);
    const list = $('list');
    if (!d.items.length) {
      list.replaceChildren(h('div', { class: 'order-empty' },
        state.status ? 'ไม่มีคำสั่งซื้อในสถานะนี้' : (state.role === 'seller' ? 'ยังไม่มีคำสั่งซื้อจากร้านของคุณ' : 'ยังไม่มีคำสั่งซื้อ ชนะการประมูลหรือกดซื้อทันทีแล้วคำสั่งซื้อจะขึ้นที่นี่')));
    } else {
      list.replaceChildren(...d.items.map((o) => {
        const other = state.role === 'seller' ? `ผู้ซื้อ ${o.buyer.displayName}` : `ร้าน ${o.seller.displayName}`;
        const note = hint(o);
        return h('a', { class: 'order-card', href: `/pages/orders.html?id=${o.id}` },
          thumb(o.listing.coverUrl),
          h('div', { style: 'min-width:0' },
            h('div', { class: 'title', text: o.listing.title }),
            h('div', { class: 'meta', text: `${code(o.id)} · ${other} · ${when(o.createdAt)}` }),
            note ? h('div', { class: 'meta', text: note }) : null),
          h('div', { class: 'right' }, h('div', { class: 'amount', text: baht(o.totalAmount) }), statusBadge(o.status)));
      }));
    }
    const pages = Math.max(1, Math.ceil(d.total / d.limit));
    const pager = $('pager');
    pager.replaceChildren();
    if (pages > 1) {
      const btn = (label, page, disabled) => h('button', { type: 'button', class: 'btn', text: label, disabled,
        onclick: () => { state.page = page; load(); } });
      pager.append(btn('‹ ก่อนหน้า', state.page - 1, state.page <= 1),
        h('span', { class: 'muted', text: `หน้า ${state.page} / ${pages}` }),
        btn('ถัดไป ›', state.page + 1, state.page >= pages));
    }
  }

  async function load() {
    const q = new URLSearchParams({ role: state.role, page: state.page, limit: 10 });
    if (state.status) q.set('status', state.status);
    history.replaceState(null, '', `?${new URLSearchParams({ ...(state.role === 'seller' ? { role: 'seller' } : {}), ...(state.status ? { status: state.status } : {}) })}`);
    try {
      renderList(await api.get(`/orders?${q}`));
      $('alert').replaceChildren();
    } catch (e) {
      $('alert').replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: e.message }));
    }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }

    const id = params.get('id');
    if (id && (u.role === 'admin' || u.role === 'super_admin')) { location.href = `/pages/admin/orders.html?id=${encodeURIComponent(id)}`; return; }
    if (id) {
      $('list-view').hidden = true;
      $('detail-view').hidden = false;
      window.OrderView.mount($('detail-view'), id, { backHref: '/pages/orders.html' });
      return;
    }
    if (u.role === 'admin' || u.role === 'super_admin') { location.href = '/pages/admin/orders.html'; return; }
    if (u.role === 'seller') {
      $('role-tabs').hidden = false;
      $('role-tabs').querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-selected', String(b.dataset.role === state.role));
        b.addEventListener('click', () => {
          state.role = b.dataset.role;
          state.status = '';
          state.page = 1;
          $('role-tabs').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
          load();
        });
      });
    } else {
      state.role = 'buyer';
    }
    load();
  });
})();
