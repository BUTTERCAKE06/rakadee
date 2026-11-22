// คำสั่งซื้อทั้งหมด (api-spec 8.7) + รายละเอียด ?id= (8.2 มุมแอดมิน ดูอย่างเดียว) — เจ้าของ: PM
(() => {
  const { h, statusBadge, baht, when, code } = window.OrderView;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const state = { page: 1, q: params.get('q') || '', status: params.get('status') || '' };

  function render(d) {
    const rows = $('rows');
    if (!d.items.length) {
      rows.replaceChildren(h('tr', null, h('td', { colspan: '7', class: 'muted', style: 'text-align:center;padding:32px', text: 'ไม่พบคำสั่งซื้อตามเงื่อนไข' })));
    } else {
      rows.replaceChildren(...d.items.map((o) => {
        const tr = h('tr', { tabindex: '0' },
          h('td', null, h('a', { href: `?id=${o.id}`, text: code(o.id) })),
          h('td', { text: o.listing.title }),
          h('td', { text: o.buyer.displayName }),
          h('td', { text: o.seller.displayName }),
          h('td', { text: baht(o.totalAmount) }),
          h('td', null, statusBadge(o.status)),
          h('td', { text: when(o.createdAt) }));
        const open = () => { location.href = `?id=${o.id}`; };
        tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') open(); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
        return tr;
      }));
    }
    const pages = Math.max(1, Math.ceil(d.total / d.limit));
    const pager = $('pager');
    pager.replaceChildren();
    if (pages > 1) {
      const btn = (label, page, disabled) => h('button', { type: 'button', class: 'btn', text: label, disabled,
        onclick: () => { state.page = page; load(); } });
      pager.append(btn('‹ ก่อนหน้า', state.page - 1, state.page <= 1),
        h('span', { class: 'muted', text: `หน้า ${state.page} / ${pages} (${d.total.toLocaleString('th-TH')} รายการ)` }),
        btn('ถัดไป ›', state.page + 1, state.page >= pages));
    }
  }

  async function load() {
    const q = new URLSearchParams({ page: state.page, limit: 20 });
    if (state.q) q.set('q', state.q);
    if (state.status) q.set('status', state.status);
    try {
      render(await api.get(`/admin/orders?${q}`));
      $('alert').replaceChildren();
    } catch (e) {
      $('alert').replaceChildren(h('div', { class: 'alert alert-error', role: 'alert', text: e.message }));
    }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname)}`; return; }
    if (u.role !== 'admin' && u.role !== 'super_admin') { location.href = '/'; return; }

    const id = params.get('id');
    if (id) {
      $('list-view').hidden = true;
      $('detail-view').hidden = false;
      window.OrderView.mount($('detail-view'), id, { backHref: '/pages/admin/orders.html' });
      return;
    }
    $('q').value = state.q;
    $('status').value = state.status;
    $('filters').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.q = $('q').value.trim();
      state.status = $('status').value;
      state.page = 1;
      load();
    });
    $('filters').addEventListener('reset', () => { state.q = ''; state.status = ''; state.page = 1; setTimeout(load); });
    load();
  });
})();
