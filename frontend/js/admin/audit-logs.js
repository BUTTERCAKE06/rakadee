// Audit Log (api-spec 11.7, requirement 8.2-6) — เจ้าของ: PM
// Admin เห็นเฉพาะของตัวเอง, Super Admin เห็นทั้งหมดและกรองตามแอดมินได้ (requirement 8.1)
(() => {
  const $ = (id) => document.getElementById(id);
  const ACTION_LABEL = {
    SELLER_APPROVE: 'อนุมัติร้านค้า',
    SELLER_REJECT: 'ไม่อนุมัติร้านค้า',
    LISTING_APPROVE: 'อนุมัติสินค้า',
    LISTING_REJECT: 'ไม่อนุมัติสินค้า',
    PAYMENT_APPROVE: 'อนุมัติการชำระเงิน',
    PAYMENT_REJECT: 'ปฏิเสธการชำระเงิน',
    DISPUTE_STATUS: 'เปลี่ยนสถานะข้อพิพาท',
    DISPUTE_RESOLVE: 'ตัดสินข้อพิพาท',
    USER_STATUS: 'เปลี่ยนสถานะบัญชี',
    USER_BAN: 'แบนผู้ใช้',
    BLACKLIST_REVOKE: 'ปลดแบน',
    FLAG_REVIEW: 'ตรวจบิดน่าสงสัย',
    SETTING_UPDATE: 'แก้ตั้งค่าระบบ',
  };
  const TARGET_LABEL = { listing: 'สินค้า', order: 'คำสั่งซื้อ', payment: 'การชำระเงิน', user: 'ผู้ใช้', dispute: 'ข้อพิพาท', setting: 'ตั้งค่า' };
  const state = { page: 1, limit: 20, filters: {}, filtersLoaded: false };

  function showError(message) {
    const box = $('alert');
    box.replaceChildren();
    if (!message) return;
    const div = document.createElement('div');
    div.className = 'alert alert-error';
    div.textContent = message;
    box.appendChild(div);
  }

  function fillSelect(select, options) {
    const keep = select.value;
    select.replaceChildren(new Option('ทั้งหมด', ''));
    options.forEach(([value, label]) => select.appendChild(new Option(label, value)));
    select.value = keep;
  }

  function td(text, cls) {
    const c = document.createElement('td');
    if (cls) c.className = cls;
    c.textContent = text;
    return c;
  }

  function render(d) {
    const rows = $('rows');
    rows.replaceChildren();
    if (!d.items.length) {
      const tr = document.createElement('tr');
      const c = td('ไม่พบบันทึกตามเงื่อนไข', 'empty');
      c.colSpan = 5;
      tr.appendChild(c);
      rows.appendChild(tr);
    }
    d.items.forEach((l) => {
      const tr = document.createElement('tr');
      const action = document.createElement('td');
      const label = document.createElement('div');
      label.textContent = ACTION_LABEL[l.action] || l.action;
      const code = document.createElement('code');
      code.className = 'muted';
      code.textContent = l.action;
      action.append(label, code);
      const target = document.createElement('td');
      target.textContent = `${TARGET_LABEL[l.targetType] || l.targetType} #${l.targetId}`;
      if (l.detail) {
        const det = document.createElement('div');
        det.className = 'detail';
        det.textContent = Object.entries(l.detail).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
        target.appendChild(det);
      }
      tr.append(
        td(new Date(l.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })),
        td(l.admin.displayName),
        action,
        target,
        td(l.ipAddress),
      );
      rows.appendChild(tr);
    });

    if (!state.filtersLoaded) {
      fillSelect($('action'), d.filters.actions.map((a) => [a, ACTION_LABEL[a] || a]));
      if (d.filters.admins.length) {
        fillSelect($('adminId'), d.filters.admins.map((a) => [String(a.id), a.displayName]));
        $('admin-filter').hidden = false;
      }
      state.filtersLoaded = true;
    }

    const pages = Math.max(1, Math.ceil(d.total / state.limit));
    const pager = $('pager');
    pager.replaceChildren();
    if (pages > 1) {
      const btn = (label, page, disabled) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = label;
        b.disabled = disabled;
        b.onclick = () => { state.page = page; load(); };
        return b;
      };
      const info = document.createElement('span');
      info.className = 'muted';
      info.textContent = `หน้า ${state.page} / ${pages} (${d.total.toLocaleString('th-TH')} รายการ)`;
      pager.append(btn('‹ ก่อนหน้า', state.page - 1, state.page <= 1), info, btn('ถัดไป ›', state.page + 1, state.page >= pages));
    }
  }

  async function load() {
    const q = new URLSearchParams({ page: state.page, limit: state.limit });
    Object.entries(state.filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    try {
      render(await api.get(`/admin/audit-logs?${q}`));
      showError('');
    } catch (e) {
      showError(e.message);
    }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = '/pages/login.html?next=' + encodeURIComponent(location.pathname); return; }
    if (u.role !== 'admin' && u.role !== 'super_admin') { location.href = '/'; return; }
    $('scope').textContent = u.role === 'super_admin'
      ? 'Super Admin เห็นบันทึกของแอดมินทุกคน'
      : 'แสดงเฉพาะการกระทำของคุณ (Super Admin เท่านั้นที่ดูของแอดมินคนอื่นได้)';

    $('filters').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      if (f.from && f.to && f.from > f.to) { showError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด'); return; }
      state.filters = f;
      state.page = 1;
      load();
    });
    $('filters').addEventListener('reset', () => {
      state.filters = {};
      state.page = 1;
      setTimeout(load);
    });
    load();
  });
})();
