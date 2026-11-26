// การประมูล (Bid Log) — api-spec 11.11 (ประวัติการบิด) / 11.12 (ผลการประมูล) — เจ้าของ: PM
// กดชื่อสินค้า / ผู้บิด / ผู้ชนะ / หมวด ในตาราง เพื่อกรองต่อ · วงเงิน Proxy ไม่แสดง (เป็นความลับของเจ้าของ)
(() => {
  const $ = (id) => document.getElementById(id);
  const TYPE_LABEL = { manual: 'บิดเอง', auto: 'ระบบบิดแทน (Proxy)', buy_now: 'ซื้อทันที' };
  const RESULT_LABEL = { has_winner: 'มีผู้ชนะ', buy_now: 'ซื้อทันที', below_reserve: 'ไม่ถึงราคาขั้นต่ำ', no_bid: 'ไม่มีผู้บิด' };
  const RESULT_BADGE = { has_winner: 'badge-success', buy_now: 'badge-success', below_reserve: 'badge-warning', no_bid: '' };
  const ORDER_LABEL = {
    pending_payment: 'รอชำระ', awaiting_shipment: 'รอจัดส่ง', shipped: 'กำลังจัดส่ง',
    completed: 'สำเร็จ', disputed: 'ข้อพิพาท', cancelled: 'ยกเลิก',
  };
  const STATUS_LABEL = { active: 'กำลังประมูล', ended: 'จบแล้ว', cancelled: 'ยกเลิก' };
  const HEAD = {
    bids: ['วัน-เวลา', 'สินค้า', 'ผู้บิด', 'ราคาที่บิด', 'ประเภท', 'สถานะ', 'IP'],
    results: ['ปิดเมื่อ', 'สินค้า', 'ผล', 'ผู้ชนะ', 'ราคาปิด', 'การบิด', 'คำสั่งซื้อ'],
  };

  const state = { tab: 'bids', page: 1, limit: 20, filters: {}, listing: null, bidder: null, result: '' };

  function showError(message) {
    const box = $('alert');
    box.replaceChildren();
    if (!message) return;
    const div = document.createElement('div');
    div.className = 'alert alert-error';
    div.textContent = message;
    box.appendChild(div);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  const baht = (n) => (n === null || n === undefined ? '-' : `฿${Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`);
  const when = (d, withSec) => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: withSec ? 'medium' : 'short' });
  const badge = (text, cls) => el('span', `badge ${cls || ''}`.trim(), text);

  function linkBtn(text, onClick, title) {
    const b = el('button', 'link-btn', text);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- ตัวกรองจากการกดในตาราง
  function filterCategory(cat) {
    $('categoryId').value = String(cat.id);
    state.filters.categoryId = String(cat.id);
    reload();
  }
  function filterListing(l) {
    state.listing = { id: l.id, title: l.title };
    switchTab('bids', false);
    reload();
  }
  function filterBidder(u) {
    state.bidder = { id: u.id, name: u.displayName };
    switchTab('bids', false);
    reload();
  }

  function renderChips() {
    const box = $('chips');
    box.replaceChildren();
    const chip = (label, clear) => {
      const c = el('span', 'chip', label);
      const x = el('button', '', '×');
      x.type = 'button';
      x.setAttribute('aria-label', `เอาตัวกรอง ${label} ออก`);
      x.addEventListener('click', () => { clear(); reload(); });
      c.appendChild(x);
      box.appendChild(c);
    };
    if (state.tab !== 'bids') return;
    if (state.listing) chip(`สินค้า #${state.listing.id} ${state.listing.title}`, () => { state.listing = null; });
    if (state.bidder) chip(`ผู้บิด ${state.bidder.name}`, () => { state.bidder = null; });
  }

  function listingCell(l, onTitle) {
    const c = el('td', 'listing');
    const top = el('div');
    top.appendChild(linkBtn(l.title, onTitle, 'กดเพื่อดูการบิดทั้งหมดของสินค้านี้'));
    const open = el('a', 'sub', ' ↗');
    open.href = `/pages/listing.html?id=${l.id}`;
    open.target = '_blank';
    open.rel = 'noopener';
    open.title = 'เปิดหน้าสินค้า';
    top.appendChild(open);
    const sub = el('div', 'sub');
    sub.appendChild(document.createTextNode(`#${l.id} · `));
    const catName = l.category.parentName ? `${l.category.parentName} › ${l.category.name}` : l.category.name;
    sub.appendChild(linkBtn(catName, () => filterCategory(l.category), 'กรองตามหมวดนี้'));
    if (l.seller) sub.appendChild(document.createTextNode(` · ผู้ขาย ${l.seller.displayName}`));
    c.append(top, sub);
    return c;
  }

  function personCell(u, onClick) {
    const c = el('td', 'person');
    if (!u) { c.textContent = '-'; return c; }
    c.appendChild(linkBtn(u.displayName, onClick, 'กดเพื่อดูการบิดทั้งหมดของคนนี้'));
    c.appendChild(el('div', 'sub', `@${u.username}`));
    return c;
  }

  function renderBids(d) {
    $('summary').textContent = `พบ ${d.total.toLocaleString('th-TH')} บิด จากผู้บิด ${d.summary.bidders.toLocaleString('th-TH')} คน ในสินค้า ${d.summary.listings.toLocaleString('th-TH')} รายการ`;
    return d.items.map((b) => {
      const tr = el('tr');
      const status = el('td', 'nowrap');
      if (b.standing === 'won') status.appendChild(badge('ชนะ', 'badge-success'));
      else if (b.standing === 'leading') status.appendChild(badge('นำอยู่', 'badge-warning'));
      else status.appendChild(el('span', 'sub', b.listing.status === 'ended' ? (RESULT_LABEL[b.listing.result] ? `จบแล้ว · ${RESULT_LABEL[b.listing.result]}` : 'จบแล้ว') : (STATUS_LABEL[b.listing.status] || b.listing.status)));
      tr.append(
        el('td', 'nowrap', when(b.createdAt, true)),
        listingCell(b.listing, () => filterListing(b.listing)),
        personCell(b.bidder, () => filterBidder(b.bidder)),
        el('td', 'num', baht(b.amount)),
        el('td', 'nowrap', TYPE_LABEL[b.bidType] || b.bidType),
        status,
        el('td', 'sub', b.ipAddress || '-'),
      );
      return tr;
    });
  }

  function renderResultPills(sum) {
    const box = $('result-pills');
    box.replaceChildren();
    const all = sum.hasWinner + sum.buyNow + sum.belowReserve + sum.noBid;
    const items = [['', 'ทั้งหมด', all], ['has_winner', RESULT_LABEL.has_winner, sum.hasWinner], ['buy_now', RESULT_LABEL.buy_now, sum.buyNow],
      ['below_reserve', RESULT_LABEL.below_reserve, sum.belowReserve], ['no_bid', RESULT_LABEL.no_bid, sum.noBid]];
    items.forEach(([value, label, n]) => {
      const b = el('button', value === state.result ? 'active' : '', `${label} (${n.toLocaleString('th-TH')})`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(value === state.result));
      b.addEventListener('click', () => { state.result = value; reload(); });
      box.appendChild(b);
    });
  }

  function renderResults(d) {
    renderResultPills(d.summary);
    $('summary').textContent = `พบ ${d.total.toLocaleString('th-TH')} รายการที่ปิดประมูลแล้ว`;
    return d.items.map((r) => {
      const tr = el('tr');
      const result = el('td', 'nowrap');
      result.appendChild(badge(RESULT_LABEL[r.result] || r.result, RESULT_BADGE[r.result]));
      const bids = el('td', 'nowrap', `${r.bidCount.toLocaleString('th-TH')} บิด`);
      bids.appendChild(el('div', 'sub', `ผู้บิด ${r.bidderCount.toLocaleString('th-TH')} คน`));
      const order = el('td', 'nowrap');
      if (r.order) {
        const a = el('a', '', `#ORD-${r.order.id}`);
        a.href = `/pages/admin/orders.html?q=${r.order.id}`;
        order.append(a, el('div', 'sub', ORDER_LABEL[r.order.status] || r.order.status));
      } else order.textContent = '-';
      tr.append(
        el('td', 'nowrap', when(r.closedAt, false)),
        listingCell({ ...r.listing, seller: r.seller }, () => filterListing(r.listing)),
        result,
        personCell(r.winner, () => filterBidder(r.winner)),
        el('td', 'num', baht(r.finalPrice)),
        bids,
        order,
      );
      return tr;
    });
  }

  function renderPager(total) {
    const pages = Math.max(1, Math.ceil(total / state.limit));
    const pager = $('pager');
    pager.replaceChildren();
    if (pages <= 1) return;
    const btn = (label, page, disabled) => {
      const b = el('button', 'btn', label);
      b.type = 'button';
      b.disabled = disabled;
      b.onclick = () => { state.page = page; load(); };
      return b;
    };
    pager.append(
      btn('‹ ก่อนหน้า', state.page - 1, state.page <= 1),
      el('span', 'muted', `หน้า ${state.page} / ${pages}`),
      btn('ถัดไป ›', state.page + 1, state.page >= pages),
    );
  }

  async function load() {
    const isBids = state.tab === 'bids';
    const q = new URLSearchParams({ page: state.page, limit: state.limit });
    Object.entries(state.filters).forEach(([k, v]) => { if (v && (isBids || k !== 'type')) q.set(k, v); });
    if (isBids && state.listing) q.set('listingId', state.listing.id);
    if (isBids && state.bidder) q.set('bidderId', state.bidder.id);
    if (!isBids && state.result) q.set('result', state.result);
    renderChips();
    try {
      const d = await api.get(`/admin/${isBids ? 'bids' : 'auction-results'}?${q}`);
      if (state.tab !== (isBids ? 'bids' : 'results')) return; // สลับแท็บระหว่างโหลด
      const rows = isBids ? renderBids(d) : renderResults(d);
      const body = $('rows');
      body.replaceChildren(...rows);
      if (!rows.length) {
        const tr = el('tr');
        const c = el('td', 'empty', 'ไม่พบข้อมูลตามเงื่อนไข');
        c.colSpan = HEAD[state.tab].length;
        tr.appendChild(c);
        body.appendChild(tr);
      }
      renderPager(d.total);
      showError('');
    } catch (e) {
      showError(e.message);
    }
  }

  function reload() { state.page = 1; load(); }

  function switchTab(tab, doLoad = true) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const tr = el('tr');
    HEAD[tab].forEach((h) => tr.appendChild(el('th', '', h)));
    $('thead').replaceChildren(tr);
    $('type-group').hidden = tab !== 'bids';
    $('result-pills').hidden = tab !== 'results';
    $('q').placeholder = tab === 'bids' ? 'ชื่อสินค้า หรือชื่อผู้บิด' : 'ชื่อสินค้า ผู้ขาย หรือผู้ชนะ';
    $('rows').replaceChildren();
    $('summary').textContent = '';
    if (doLoad) reload();
  }

  async function loadCategories() {
    try {
      const d = await api.get('/categories');
      const select = $('categoryId');
      d.items.forEach((main) => {
        select.appendChild(new Option(`${main.name} (ทั้งหมด)`, String(main.id)));
        (main.children || []).forEach((c) => {
          select.appendChild(new Option(`　└ ${c.name}`, String(c.id)));
        });
      });
    } catch { /* โหลดหมวดไม่ได้ ยังกดหมวดในตารางได้ */ }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = '/pages/login.html?next=' + encodeURIComponent(location.pathname); return; }
    if (u.role !== 'admin' && u.role !== 'super_admin') { location.href = '/'; return; }

    document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('filters').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      if (f.from && f.to && f.from > f.to) { showError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด'); return; }
      f.q = (f.q || '').trim();
      state.filters = f;
      reload();
    });
    $('filters').addEventListener('reset', () => {
      state.filters = {};
      state.listing = null;
      state.bidder = null;
      state.result = '';
      setTimeout(reload);
    });

    loadCategories();
    switchTab('bids');
  });
})();
