// admin/users.js — จัดการผู้ใช้ (api-spec 10.1–10.5) เจ้าของ: QA
// สิทธิ์ (ข้อ 8.1): Admin แก้/แบนแอดมินคนอื่นไม่ได้ และปลดแบนไม่ได้ · Super Admin ทำได้ทั้งหมด · แก้บัญชีตัวเองไม่ได้
// ปุ่มที่ไม่มีสิทธิ์จะถูกซ่อน แต่ BE ตรวจซ้ำทุกครั้ง
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { q: '', status: '', page: 1, selected: null };
  let me = null;

  const maskPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 3)}-***-${p.slice(6)}` : p || '-');
  // รูปแบบตามภาพ *********-9-12-3 ใช้ได้แค่ 4 ตัวท้าย (api-spec 0.5)
  const maskIdCard = (last4) => (last4 ? `*********-${last4[0]}-${last4.slice(1, 3)}-${last4[3]}` : '-');
  const isAdminRole = (r) => r === 'admin' || r === 'super_admin';

  async function loadList() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ page: state.page });
    ['q', 'status'].forEach((k) => { if (state[k]) params.set(k, state[k]); });
    try {
      const data = await api.get(`/admin/users?${params}`);
      if (!data.items.length) {
        rows.replaceChildren(el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'ไม่พบผู้ใช้' })));
      } else {
        rows.replaceChildren(...data.items.map((u) => {
          const tr = el('tr', { class: `is-click${state.selected === u.id ? ' is-selected' : ''}`, tabindex: 0, 'data-id': u.id },
            el('td', { text: u.fullName || u.displayName, title: `@${u.username} · ${qa.ROLE[u.role] || u.role}` }),
            el('td', { text: u.email }),
            el('td', { text: maskPhone(u.phone) }),
            el('td', { text: maskIdCard(u.idCardLast4) }),
            el('td', {}, qa.pill(qa.USER_STATUS, u.status)));
          const open = () => selectUser(u.id);
          tr.addEventListener('click', open);
          tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
          return tr;
        }));
      }
      qa.pagination($('pagination'), data, (p) => { state.page = p; loadList(); });
    } catch (err) {
      rows.replaceChildren();
      qa.alertBox($('alert-area'), err.message);
    }
  }

  async function selectUser(id) {
    state.selected = id;
    document.querySelectorAll('#rows tr').forEach((tr) => tr.classList.toggle('is-selected', Number(tr.dataset.id) === id));
    const panel = $('panel');
    panel.replaceChildren(el('p', { class: 'muted', text: 'กำลังโหลด...' }));
    try {
      const [profile, flags] = await Promise.all([api.get(`/admin/users/${id}`), userFlags(id).catch(() => [])]);
      renderPanel(profile, flags);
    } catch (err) {
      panel.replaceChildren(el('div', { class: 'alert alert-error', text: err.message }));
    }
  }

  function listSection(title, items, renderItem, emptyText) {
    return [el('h3', { class: 'qa-section-sm', text: title }),
      el('ul', 'qa-list-plain', ...(items.length ? items.map(renderItem) : [el('li', { class: 'muted', text: emptyText })]))];
  }

  function renderPanel(d, flags = []) {
    const u = d.user;
    const canModify = me.id !== u.id && (!isAdminRole(u.role) || me.role === 'super_admin');
    const nonPay = d.penalties.filter((p) => p.type === 'non_payment').length;
    const noShip = d.penalties.filter((p) => p.type === 'no_shipment').length;
    const penaltyText = d.penalties.length
      ? [nonPay && `ไม่ชำระ ${nonPay} ครั้ง`, noShip && `ไม่ส่งของ ${noShip} ครั้ง`, d.penalties.length - nonPay - noShip
        && `อื่นๆ ${d.penalties.length - nonPay - noShip} ครั้ง`].filter(Boolean).join(', ')
      : 'ไม่มี';

    // แถวหลักตามภาพ: ยอด Mock Wallet / ประวัติประมูล / ขาย / ประวัติความผิด / ธุรกรรมย้อนหลัง
    const more = el('button', { type: 'button', class: 'btn btn-link', style: 'padding:0;', text: 'ดูทั้งหมด →' });
    const kv = [
      ['ยอด Mock Wallet', d.wallet ? qa.money(d.wallet.balance) : '-'],
      ['ประวัติประมูล / ขาย', `${d.stats.bids} / ${d.stats.sold} รายการ`],
      ['ประวัติความผิด', penaltyText],
      ['ธุรกรรมย้อนหลัง', more],
    ];
    // เพิ่มจากภาพ: สถานะที่ไม่ใช่ปกติ
    if (u.status !== 'active') kv.unshift(['สถานะ', qa.pill(qa.USER_STATUS, u.status)]);
    if (u.statusUntil) kv.splice(1, 0, ['ถึงวันที่', qa.dateTime(u.statusUntil)]);

    const actions = el('div', 'qa-panel-actions');
    if (canModify && u.status !== 'banned' && u.status !== 'pending_verification') {
      actions.append(el('button', { type: 'button', class: 'btn btn-outline-navy', text: 'ระงับชั่วคราว', onclick: () => openStatusModal(u) }));
      actions.append(el('button', { type: 'button', class: 'btn btn-danger', text: 'แบนถาวร (Blacklist)', onclick: () => openBanModal(u) }));
    }
    const canRestore = canModify && (u.status === 'restricted' || u.status === 'suspended' || (u.status === 'banned' && me.role === 'super_admin'));
    if (canRestore) actions.append(el('button', { type: 'button', class: 'btn btn-primary', text: 'คืนสถานะปกติ', onclick: () => openRestoreModal(u) }));

    const activeBl = d.blacklists.filter((b) => !b.revokedAt);
    const blSection = activeBl.length ? listSection('Blacklist', activeBl, (b) => el('li', {},
      el('span', {}, el('div', { text: b.reason }), el('small', { class: 'muted', text: `${b.phone || ''}${b.hasIdCard ? ' + เลขบัตร' : ''} · ${qa.date(b.createdAt)}` })),
      me.role === 'super_admin'
        ? el('button', { type: 'button', class: 'btn', text: 'ปลดแบน', onclick: () => openRevokeModal(b, u) })
        : el('span', { class: 'muted', text: 'เฉพาะ Super Admin' })), '') : [];

    // รายละเอียดทั้งหมด (เปิดจาก "ดูทั้งหมด →"): ข้อมูลบัญชี ธุรกรรม ความผิด การบิด คำสั่งซื้อ
    const details = el('div', { hidden: true },
      ...listSection('ข้อมูลบัญชี', [
        ['ชื่อที่แสดง', `${u.displayName} (@${u.username})`], ['บทบาท', qa.ROLE[u.role] || u.role],
        ['อีเมล', `${u.email}${u.emailVerified ? ' ✓' : ''}`], ['เบอร์', `${u.phone}${u.phoneVerified ? ' ✓' : ''}`],
        ['บัตร ปชช.', maskIdCard(u.idCardLast4)], ['สมัครเมื่อ', qa.date(u.createdAt)],
        ...(u.shop ? [['ร้านค้า', `${u.shop.shopName} (${qa.SHOP_STATUS[u.shop.status][0]})`]] : []),
        ...(u.statusReason ? [['เหตุผลสถานะ', u.statusReason]] : []),
      ], ([k, v]) => el('li', {}, el('span', { class: 'muted', text: k }), el('span', { text: v })), ''),
      ...listSection(`ธุรกรรมย้อนหลัง (${d.transactions.length})`, d.transactions, (t) => el('li', {},
        el('span', {}, el('div', { text: t.note || t.type }), el('small', { class: 'muted', text: qa.dateTime(t.createdAt) })),
        el('strong', { text: `${t.amount > 0 ? '+' : ''}${qa.money(t.amount)}` })), 'ไม่มีธุรกรรม'),
      ...listSection('ประวัติความผิด', d.penalties, (p) => el('li', {},
        el('span', {}, el('div', { text: `${qa.PENALTY_TYPE[p.type] || p.type} · ${qa.PENALTY_ACTION[p.action] || p.action}` }),
          p.note ? el('small', { class: 'muted', text: p.note }) : ''),
        el('small', { class: 'muted', text: qa.date(p.createdAt) })), 'ไม่มี'),
      ...listSection('การบิดล่าสุด', d.recentBids.slice(0, 10), (b) => el('li', {},
        el('span', { text: b.listingTitle }), el('span', { text: qa.money(b.amount) })), 'ไม่มี'),
      ...listSection('คำสั่งซื้อล่าสุด', d.recentOrders.slice(0, 10), (o) => el('li', {},
        el('span', { text: `${qa.orderCode(o.id)} ${o.listingTitle} (${o.role === 'buyer' ? 'ซื้อ' : 'ขาย'})` }), el('span', { text: qa.label(qa.ORDER_STATUS, o.status) })), 'ไม่มี'));
    more.addEventListener('click', () => {
      details.hidden = !details.hidden;
      more.textContent = details.hidden ? 'ดูทั้งหมด →' : 'ซ่อน ↑';
    });

    $('panel').replaceChildren(
      el('h2', { class: 'qa-card-title', text: `โปรไฟล์ — ${u.fullName}` }),
      el('dl', { class: 'qa-kv', style: 'margin-top:12px;' }, ...kv.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)])),
      actions.childElementCount ? actions : el('p', { class: 'muted', text: me.id === u.id ? 'นี่คือบัญชีของคุณ' : 'ไม่มีสิทธิ์จัดการบัญชีนี้' }),
      el('p', { class: 'hint', text: 'แบนถาวรจะบล็อกเลขบัตรและเบอร์โทรไม่ให้สมัครใหม่' }),
      ...blSection,
      // บิดน่าสงสัยที่เกี่ยวกับผู้ใช้คนนี้ (เป็นผู้บิดหรือผู้ขาย) — แสดงเมื่อมี
      ...(flags.length ? listSection(`บิดน่าสงสัย (${flags.length})`, flags, (f) => el('li', {},
        el('span', {},
          el('div', {}, el('span', { class: 'qa-pill is-danger', text: FLAG_REASON[f.reason] || f.reason }), ' ',
            f.bidder.id === u.id ? `บิดสินค้าร้าน ${f.seller.displayName}` : `${f.bidder.displayName} บิดสินค้าของร้านนี้`),
          el('small', { class: 'muted', text: `${f.listing.title} · ${qa.date(f.createdAt)}` })),
        f.reviewedAt
          ? el('small', { class: 'badge-verified', text: '✓ ตรวจแล้ว' })
          : el('button', { type: 'button', class: 'btn btn-sm', text: 'ตรวจแล้ว', onclick: (ev) => reviewFlag(f, ev.currentTarget) })), '') : []),
      details,
    );
  }

  const afterChange = async (message) => {
    qa.alertBox($('alert-area'), message, 'success');
    await Promise.all([loadList(), selectUser(state.selected)]);
  };

  function reasonField(id, label) {
    const input = el('textarea', { id, rows: 2, maxlength: 255 });
    return { input, node: el('div', 'form-group', el('label', { for: id, text: label }), input, el('span', { class: 'field-error', id: 'err-reason' })) };
  }

  function openStatusModal(u) {
    const select = el('select', { id: 'st-status' },
      el('option', { value: 'suspended', text: 'ระงับชั่วคราว (บิดและลงสินค้าไม่ได้)' }),
      el('option', { value: 'restricted', text: 'จำกัดสิทธิ์ (บิดได้ ลงสินค้าไม่ได้)' }));
    const until = el('input', { type: 'datetime-local', id: 'st-until' });
    const def = new Date(Date.now() + 7 * 86400000 - new Date().getTimezoneOffset() * 60000);
    until.value = def.toISOString().slice(0, 16);
    const reason = reasonField('st-reason', 'เหตุผล (บังคับ)');
    qa.modal({
      title: `เปลี่ยนสถานะ — ${u.displayName}`,
      body: el('div', {},
        el('div', 'form-group', el('label', { for: 'st-status', text: 'สถานะใหม่' }), select),
        el('div', 'form-group', el('label', { for: 'st-until', text: 'ถึงวันที่' }), until, el('span', { class: 'field-error', id: 'err-until' })),
        reason.node),
      confirmText: 'บันทึก',
      onConfirm: async () => {
        await api.post(`/admin/users/${u.id}/status`, {
          status: select.value,
          until: until.value ? new Date(until.value).toISOString() : null,
          reason: reason.input.value.trim(),
        });
        await afterChange('เปลี่ยนสถานะบัญชีแล้ว');
      },
    });
  }

  function openRestoreModal(u) {
    const reason = reasonField('rs-reason', 'เหตุผล (บังคับ)');
    qa.modal({
      title: `คืนสถานะปกติ — ${u.displayName}`,
      body: el('div', {}, u.status === 'banned'
        ? el('p', { class: 'hint', text: 'บัญชีที่ถูกแบน: ควรปลด Blacklist ก่อน (ปุ่มปลดแบน) เพื่อให้เลขบัตร/เบอร์ใช้ได้อีก' }) : '', reason.node),
      confirmText: 'คืนสถานะ',
      onConfirm: async () => {
        await api.post(`/admin/users/${u.id}/status`, { status: 'active', reason: reason.input.value.trim() });
        await afterChange('คืนสถานะบัญชีเป็นปกติแล้ว');
      },
    });
  }

  function openBanModal(u) {
    const reason = reasonField('ban-reason', 'เหตุผลการแบน (บังคับ)');
    reason.input.maxLength = 500;
    qa.modal({
      title: `แบนถาวร — ${u.displayName}`,
      body: el('div', {},
        el('p', { class: 'muted', style: 'margin-top:0;', text: 'ระบบจะเปลี่ยนสถานะเป็นแบนถาวร ยกเลิกทุก session และเพิ่มเลขบัตร/เบอร์โทรเข้า Blacklist (ปลดได้โดย Super Admin)' }),
        reason.node),
      confirmText: 'ยืนยันแบน',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await api.post(`/admin/users/${u.id}/ban`, { reason: reason.input.value.trim() });
        await afterChange('แบนบัญชีและเพิ่ม Blacklist แล้ว');
      },
    });
  }

  function openRevokeModal(b, u) {
    qa.modal({
      title: 'ปลดแบน (ปลด Blacklist)',
      body: el('p', { text: `ปลดรายการ Blacklist ของ ${u.displayName} (สถานะบัญชีไม่เปลี่ยนอัตโนมัติ ใช้ปุ่ม "คืนสถานะปกติ" ต่อ)` }),
      confirmText: 'ปลดแบน',
      onConfirm: async () => {
        await api.post(`/admin/blacklists/${b.id}/revoke`);
        await afterChange('ปลด Blacklist แล้ว');
      },
    });
  }

  /* ================= แท็บบิดน่าสงสัย (API 10.6–10.7) ================= */
  const FLAG_REASON = { same_ip: 'IP เดียวกับผู้ขาย', same_device: 'อุปกรณ์เดียวกับผู้ขาย', repeated_seller: 'บิดร้านเดิมซ้ำ' };
  const flagState = { reviewed: 'false', page: 1 };

  async function loadFlagCount() {
    try {
      const d = await api.get('/admin/suspicious-flags?reviewed=false&limit=1');
      $('flag-count').textContent = d.total;
      $('flag-count').hidden = !d.total;
    } catch { /* ไม่บังคับ */ }
  }

  // flag ทั้งหมดที่ผู้ใช้คนนี้เป็นผู้บิดหรือผู้ขาย (10.6 ไม่มีตัวกรองรายคน จึงกรองฝั่ง FE)
  async function userFlags(userId) {
    const out = [];
    for (let page = 1; page <= 10; page += 1) {
      const d = await api.get(`/admin/suspicious-flags?reviewed=all&limit=50&page=${page}`);
      out.push(...d.items.filter((f) => f.bidder.id === userId || f.seller.id === userId));
      if (page * d.limit >= d.total) break;
    }
    return out;
  }

  function openUser(id) {
    showTab('users');
    selectUser(id);
  }

  async function reviewFlag(f, btn) {
    btn.disabled = true;
    try {
      await api.post(`/admin/suspicious-flags/${f.id}/review`);
      qa.alertBox($('alert-area'), 'ทำเครื่องหมายว่าตรวจแล้ว', 'success');
      loadFlagCount();
      if (!$('tab-flags').hidden) loadFlags();
      if (state.selected) selectUser(state.selected);
    } catch (err) {
      btn.disabled = false;
      qa.alertBox($('alert-area'), err.message);
    }
  }

  async function loadFlags() {
    const rows = $('flag-rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 6, class: 'empty', text: 'กำลังโหลด...' })));
    try {
      const data = await api.get(`/admin/suspicious-flags?reviewed=${flagState.reviewed}&page=${flagState.page}`);
      const userCell = (u) => el('td', {},
        el('button', { type: 'button', class: 'btn btn-link', style: 'padding:0;', text: u.displayName, onclick: () => openUser(u.id) }),
        el('div', {}, el('small', { class: 'muted', text: `@${u.username}` })));
      rows.replaceChildren(...(data.items.length ? data.items.map((f) => el('tr', {},
        el('td', {}, el('span', { class: 'qa-pill is-danger', text: FLAG_REASON[f.reason] || f.reason }),
          f.detail ? el('div', {}, el('small', { class: 'muted', text: f.detail })) : ''),
        el('td', {}, el('a', { href: `/pages/listing.html?id=${f.listing.id}`, text: f.listing.title })),
        userCell(f.bidder),
        userCell(f.seller),
        el('td', { text: qa.dateTime(f.createdAt) }),
        el('td', {}, f.reviewedAt
          ? el('small', { class: 'muted', text: `ตรวจโดย ${f.reviewedBy ? f.reviewedBy.displayName : '-'} ${qa.date(f.reviewedAt)}` })
          : el('button', { type: 'button', class: 'btn btn-sm', text: 'ตรวจแล้ว', onclick: (ev) => reviewFlag(f, ev.currentTarget) }))))
        : [el('tr', {}, el('td', { colspan: 6, class: 'empty', text: 'ไม่มีรายการ' }))]));
      qa.pagination($('flag-pagination'), data, (p) => { flagState.page = p; loadFlags(); });
    } catch (err) {
      rows.replaceChildren();
      qa.alertBox($('alert-area'), err.message);
    }
  }

  function showTab(name) {
    $('tab-users').hidden = name !== 'users';
    $('tab-flags').hidden = name !== 'flags';
    $('main-tabs').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === name);
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    const url = new URL(location.href);
    if (name === 'flags') url.searchParams.set('tab', 'flags'); else url.searchParams.delete('tab');
    history.replaceState({}, '', url);
    if (name === 'flags') loadFlags();
  }

  document.addEventListener('user:ready', (e) => {
    me = e.detail;
    if (!qa.requireAdmin(me)) return;
    $('main-tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('flag-tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      flagState.reviewed = b.dataset.reviewed;
      flagState.page = 1;
      $('flag-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      loadFlags();
    }));
    loadFlagCount();
    if (qa.qs('tab') === 'flags') showTab('flags');
    $('search-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.q = $('search-input').value.trim();
      state.page = 1;
      loadList();
    });
    // ป้ายสถานะ: กดเพื่อกรอง กดซ้ำเพื่อยกเลิก (ไม่กรอง = ป้ายเข้มทุกอัน)
    const chips = [...$('filters').querySelectorAll('button')];
    const paintChips = () => chips.forEach((x) => {
      x.classList.toggle('is-on', !state.status || x.dataset.status === state.status);
      x.setAttribute('aria-pressed', String(x.dataset.status === state.status));
    });
    chips.forEach((b) => b.addEventListener('click', () => {
      state.status = state.status === b.dataset.status ? '' : b.dataset.status;
      state.page = 1;
      paintChips();
      loadList();
    }));
    paintChips();
    loadList();
    const pre = Number(qa.qs('id'));
    if (pre) selectUser(pre);
  });
})();
