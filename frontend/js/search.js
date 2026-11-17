// หน้าค้นหา / รายการประมูล (ข้อ 3.5)
// ค้นหาจากชื่อและรายละเอียด, กรองหมวด สภาพ ช่วงราคา สถานะ ใกล้จบ, เรียง 4 แบบ, แบ่งหน้า
// API: GET /api/listings (api-spec 5.1) ชื่อพารามิเตอร์ใน URL ของหน้านี้ใช้ชื่อเดียวกับ API
//      GET /api/categories (4.1 ของ QA), GET /api/watchlist (5.5 ถ้า login ไว้ใช้ทำหัวใจ)
(function (root) {
  'use strict';

  const PAGE_SIZE = 12;
  const NEAR_END_HOURS = 1; // ตัวกรอง "ใกล้จบ (< 1 ชม.)" ตามวาเฟรม
  const SORTS = [
    { id: 'newest', name: 'เรียง: ใหม่ล่าสุด' },
    { id: 'ending_soon', name: 'เรียง: ใกล้จบก่อน' },
    { id: 'price_asc', name: 'เรียง: ราคาต่ำ → สูง' },
    { id: 'price_desc', name: 'เรียง: ราคาสูง → ต่ำ' },
  ];
  const CONDITIONS = ['new', 'used_good', 'defective'];

  // ---------- ส่วนที่ไม่แตะ DOM ----------

  // URL ของหน้า -> state (ค่าเริ่มต้นตาม api-spec: status=active, sort=newest)
  function readState(search) {
    const p = new URLSearchParams(search);
    const sort = p.get('sort');
    const page = Number(p.get('page'));
    return {
      q: (p.get('q') || '').trim(),
      categoryId: p.get('categoryId') || '',
      conditions: (p.get('condition') || '').split(',').filter((c) => CONDITIONS.includes(c)),
      minPrice: p.get('minPrice') || '',
      maxPrice: p.get('maxPrice') || '',
      status: p.get('status') === 'ended' ? 'ended' : 'active',
      endingSoon: p.get('endingWithinHours') === String(NEAR_END_HOURS),
      sort: SORTS.some((s) => s.id === sort) ? sort : 'newest',
      page: Number.isInteger(page) && page >= 1 ? page : 1,
    };
  }

  // state -> query string (ใช้ทั้ง URL ของหน้าและเรียก API) ไม่ใส่ค่าที่เป็นค่าเริ่มต้น
  function toQuery(f, { forApi = false } = {}) {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.categoryId) p.set('categoryId', f.categoryId);
    if (f.conditions.length) p.set('condition', f.conditions.join(','));
    if (f.minPrice) p.set('minPrice', f.minPrice.replace(/,/g, ''));
    if (f.maxPrice) p.set('maxPrice', f.maxPrice.replace(/,/g, ''));
    if (f.status !== 'active') p.set('status', f.status);
    if (f.endingSoon && f.status === 'active') p.set('endingWithinHours', String(NEAR_END_HOURS));
    if (f.sort !== 'newest') p.set('sort', f.sort);
    if (f.page > 1) p.set('page', String(f.page));
    if (forApi) p.set('limit', String(PAGE_SIZE));
    return p.toString();
  }

  // ตรวจช่วงราคาที่ FE ก่อนส่ง (BE ตรวจซ้ำด้วย VALIDATION_ERROR)
  function validatePriceRange(minText, maxText, parse) {
    const out = { ok: true, min: null, max: null };
    if (minText.trim()) {
      out.min = parse(minText);
      if (out.min == null) return { ok: false, error: 'ราคาต่ำสุดต้องเป็นตัวเลขไม่ติดลบ' };
    }
    if (maxText.trim()) {
      out.max = parse(maxText);
      if (out.max == null) return { ok: false, error: 'ราคาสูงสุดต้องเป็นตัวเลขไม่ติดลบ' };
    }
    if (out.min != null && out.max != null && out.min > out.max) {
      return { ok: false, error: 'ราคาต่ำสุดต้องไม่มากกว่าราคาสูงสุด' };
    }
    return out;
  }

  // เลขหน้าที่แสดง เช่น [1, 2, 3, '…', 12]
  function pageList(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
    const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }

  const pure = { readState, toQuery, validatePriceRange, pageList, SORTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (typeof document === 'undefined') return;

  // ---------- DOM ----------
  const A = root.Auction;
  const { h } = A;
  const form = document.getElementById('search-form');
  const grid = document.getElementById('results');
  const pager = document.getElementById('pager');
  const countEl = document.getElementById('result-count');
  const priceError = document.getElementById('price-error');
  const sortSel = document.getElementById('sort');
  let state = readState(location.search);
  let watched = new Set();
  let seq = 0; // กันผลของคำขอเก่าทับคำขอใหม่

  async function loadWatched() {
    const user = await A.whenUserReady();
    if (!user || !['bidder', 'seller'].includes(user.role)) return;
    try {
      const data = await api.get('/watchlist');
      watched = new Set(data.items.map((i) => String(i.id)));
    } catch { /* หัวใจว่างไว้ก่อน */ }
  }

  async function fillStaticOptions() {
    sortSel.replaceChildren(...SORTS.map((s) => h('option', { value: s.id, text: s.name })));
    document.getElementById('cond-list').replaceChildren(...CONDITIONS.map((c) =>
      h('label', { class: 'au-check' }, h('input', { type: 'checkbox', name: 'condition', value: c }), ` ${A.CONDITION_NAMES[c]}`)));

    const list = document.getElementById('cat-list');
    const radio = (id, name, sub) => h('label', { class: sub ? 'au-check au-check-sub' : 'au-check' },
      h('input', { type: 'radio', name: 'categoryId', value: id }), ` ${name}`);
    try {
      const res = await api.get('/categories'); // QA ตอบ { items: [...] }
      const cats = Array.isArray(res) ? res : (res && res.items) || [];
      list.replaceChildren(radio('', 'ทั้งหมด', false),
        ...cats.flatMap((c) => [radio(String(c.id), c.name, false), ...(c.children || []).map((s) => radio(String(s.id), s.name, true))]));
    } catch (e) {
      A.showAlert(list, 'error', e.message);
    }
  }

  function readForm() {
    const fd = new FormData(form);
    return {
      q: String(fd.get('q') || '').trim(),
      categoryId: String(fd.get('categoryId') || ''),
      conditions: fd.getAll('condition').map(String),
      minPrice: String(fd.get('minPrice') || '').trim(),
      maxPrice: String(fd.get('maxPrice') || '').trim(),
      status: fd.get('status') === 'ended' ? 'ended' : 'active',
      endingSoon: fd.get('endingWithinHours') === '1',
      sort: String(fd.get('sort') || 'newest'),
      page: 1,
    };
  }

  function writeForm(f) {
    form.elements.q.value = f.q;
    form.elements.minPrice.value = f.minPrice;
    form.elements.maxPrice.value = f.maxPrice;
    form.querySelectorAll('input[name="status"]').forEach((i) => { i.checked = i.value === f.status; });
    form.elements.endingWithinHours.checked = f.endingSoon;
    form.elements.endingWithinHours.disabled = f.status !== 'active';
    sortSel.value = f.sort;
    form.querySelectorAll('input[name="categoryId"]').forEach((i) => { i.checked = i.value === f.categoryId; });
    form.querySelectorAll('input[name="condition"]').forEach((i) => { i.checked = f.conditions.includes(i.value); });
  }

  function renderPager(page, pages) {
    if (pages <= 1) { pager.replaceChildren(); return; }
    const btn = (label, target, opts = {}) => {
      const b = h('button', { type: 'button', text: label, 'aria-label': opts.aria || `หน้า ${target}`, 'aria-current': opts.current ? 'page' : null, disabled: opts.disabled || false });
      b.addEventListener('click', () => { state.page = target; render(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      return b;
    };
    pager.replaceChildren(
      btn('‹', page - 1, { aria: 'หน้าก่อนหน้า', disabled: page === 1 }),
      ...pageList(page, pages).map((n) => (n === '…' ? h('span', { text: '…' }) : btn(String(n), n, { current: n === page }))),
      btn('›', page + 1, { aria: 'หน้าถัดไป', disabled: page === pages }));
  }

  async function render(pushHistory) {
    const range = validatePriceRange(state.minPrice, state.maxPrice, A.parseBahtToSatang);
    priceError.textContent = range.ok ? '' : range.error;
    if (!range.ok) return;
    const qs = toQuery(state);
    if (pushHistory) history.replaceState(null, '', qs ? `?${qs}` : location.pathname);

    const mine = ++seq;
    grid.setAttribute('aria-busy', 'true');
    try {
      const data = await api.get(`/listings?${toQuery(state, { forApi: true })}`);
      if (mine !== seq) return;
      const pages = Math.max(1, Math.ceil(data.total / data.limit));
      if (state.page > pages && data.total > 0) { state.page = pages; render(true); return; }
      countEl.textContent = `พบ ${data.total.toLocaleString('th-TH')} รายการ`;
      A.renderCards(grid, data.items.map(A.normalizeCard), 'ไม่พบสินค้าที่ตรงกับเงื่อนไข ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา',
        undefined);
      grid.querySelectorAll('.au-card').forEach((card, i) => {
        const it = data.items[i];
        if (watched.has(String(it.id))) {
          const heart = card.querySelector('.au-heart');
          heart.setAttribute('aria-pressed', 'true');
          heart.textContent = '♥';
        }
      });
      renderPager(data.page, pages);
    } catch (e) {
      if (mine !== seq) return;
      countEl.textContent = '';
      pager.replaceChildren();
      A.showAlert(grid, 'error', e.message); // ApiError.message (ภาษาไทยจาก BE)
    } finally {
      if (mine === seq) grid.removeAttribute('aria-busy');
    }
  }

  function apply() {
    state = readForm();
    writeForm(state); // ปิด/เปิด "ใกล้จบ" ตามสถานะ
    render(true);
  }

  async function init() {
    await A.clockReady; // รอเวลา server ก่อนคำนวณเวลาที่เหลือ
    await Promise.all([fillStaticOptions(), loadWatched()]);
    writeForm(state);
    form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
    form.addEventListener('change', (e) => { if (e.target.name !== 'q') apply(); });
    document.getElementById('reset-filters').addEventListener('click', () => {
      state = readState('');
      writeForm(state);
      render(true);
    });
    await render(false);
    A.startTicker();
  }

  root.SearchPage = pure;
  init();
})(typeof window !== 'undefined' ? window : globalThis);