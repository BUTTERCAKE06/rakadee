// admin/listings.js — อนุมัติสินค้า (ภาพ UI A2 + Modal ปฏิเสธสินค้า, api-spec 4.10–4.13) เจ้าของ: QA
// รายการด้านซ้าย + แผงรายละเอียดด้านขวา · หน้า listing-detail.html ยังใช้ได้สำหรับดูรายละเอียดเต็ม (รายละเอียดสินค้า รูปทั้งหมด)
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = { status: 'pending_review', page: 1, selected: null, q: qa.qs('q') || '' };
  const LISTING_STATUS = {
    draft: ['ฉบับร่าง', ''], pending_review: ['รอตรวจสอบ', 'is-warning'], rejected: ['ไม่อนุมัติ', 'is-danger'],
    active: ['กำลังประมูล', 'is-success'], ended: ['สิ้นสุด', 'is-info'], cancelled: ['ยกเลิก', ''],
  };
  const REASONS = ['ภาพไม่ชัดเจน', 'ข้อมูลไม่ครบ', 'สินค้าผิดกฎ / ต้องห้าม', 'สินค้าลอกเลียนแบบ'];

  async function loadPendingCount() {
    try {
      const d = await api.get('/admin/listings?status=pending_review&limit=1');
      $('pending-count').textContent = d.total;
    } catch { /* ไม่บังคับ */ }
  }

  async function loadList() {
    const rows = $('rows');
    rows.replaceChildren(el('tr', {}, el('td', { colspan: 5, class: 'empty', text: 'กำลังโหลด...' })));
    const params = new URLSearchParams({ status: state.status, page: state.page });
    if (state.q) params.set('q', state.q);
    try {
      const data = await api.get(`/admin/listings?${params}`);
      // อัปเดตตัวเลข "รอตรวจสอบ" ทุกครั้งที่โหลดรายการ (กันตัวเลขค้างเมื่อเปิดหน้าไว้นาน)
      if (state.status === 'pending_review' && !state.q) $('pending-count').textContent = data.total;
      else loadPendingCount();
      rows.replaceChildren(...(data.items.length ? data.items.map((l) => {
        const tr = el('tr', { class: `is-click${state.selected === l.id ? ' is-selected' : ''}`, 'data-id': l.id },
          el('td', {}, el('span', { class: 'qa-cover-cell' },
            l.coverUrl ? el('img', { class: 'qa-cover-sm', src: l.coverUrl, alt: '' }) : el('span', { class: 'qa-cover-sm', text: '🖼' }),
            el('span', { text: l.title }))),
          el('td', { text: (l.seller && (l.seller.shopName || l.seller.displayName)) || '-' }),
          el('td', { text: l.categoryName || '-' }),
          el('td', { text: qa.money(l.startPrice) }),
          el('td', {}, el('button', { type: 'button', class: 'btn btn-sm btn-outline-navy', text: 'ดู' })));
        tr.addEventListener('click', () => select(l.id));
        return tr;
      }) : [el('tr', {}, el('td', { colspan: 5, class: 'empty', text: state.status ? 'ไม่มีสินค้ารอตรวจสอบ' : 'ไม่มีสินค้า' }))]));
      qa.pagination($('pagination'), data, (p) => { state.page = p; loadList(); });
    } catch (err) {
      rows.replaceChildren();
      qa.alertBox($('alert-area'), err.message);
    }
  }

  async function select(id) {
    state.selected = id;
    document.querySelectorAll('#rows tr').forEach((tr) => tr.classList.toggle('is-selected', Number(tr.dataset.id) === id));
    const panel = $('panel');
    panel.replaceChildren(el('h2', { class: 'qa-card-title', text: 'รายละเอียดสินค้า' }), el('p', { class: 'muted', text: 'กำลังโหลด...' }));
    try {
      renderPanel(await api.get(`/admin/listings/${id}`));
    } catch (err) {
      panel.append(el('div', { class: 'alert alert-error', text: err.message }));
    }
  }

  function renderPanel(l) {
    const cover = (l.images || []).find((i) => i.isCover) || (l.images || [])[0];
    const kv = [
      ['ชื่อสินค้า', l.title],
      ['ผู้ขาย', (l.seller && (l.seller.shopName || l.seller.displayName)) || '-'],
      ['Start / Increment', `${qa.money(l.startPrice)} / ${qa.money(l.bidIncrement)}`],
      ['Reserve / Buy Now', `${l.reservePrice ? qa.money(l.reservePrice) : '-'} / ${l.buyNowPrice ? qa.money(l.buyNowPrice) : '-'}`],
      ['ระยะเวลา', `${l.durationDays} วัน`],
    ];
    const nodes = [
      el('h2', { class: 'qa-card-title', text: 'รายละเอียดสินค้า' }),
      el('div', { class: 'qa-panel-img' }, cover
        ? el('a', { href: cover.url, target: '_blank', rel: 'noopener', title: 'เปิดรูปขนาดเต็ม' }, el('img', { src: cover.url, alt: l.title }))
        : '🖼'),
      el('dl', 'qa-kv', ...kv.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
      // เพิ่มจากภาพ: ลิงก์ดูรายละเอียดเต็ม (คำอธิบาย ตำหนิ รูปทั้งหมด) ไว้ตรวจสินค้าต้องห้าม
      el('p', { style: 'margin:8px 0 0;font-size:13px;' }, el('a', { href: `/pages/admin/listing-detail.html?id=${l.id}`, text: 'ดูรายละเอียดเต็ม และรูปทั้งหมด →' })),
    ];

    if (l.status === 'pending_review') {
      const reason = el('input', { type: 'text', id: 'panel-reason', maxlength: 500, placeholder: 'เช่น ภาพไม่ชัดเจน ข้อมูลไม่ครบ สินค้าผิดกฎ' });
      nodes.push(el('div', { class: 'form-group', style: 'margin-top:12px;' },
        el('label', { for: 'panel-reason', text: 'เหตุผลการปฏิเสธ (บังคับเมื่อปฏิเสธ)' }), reason));
      nodes.push(el('div', 'qa-panel-btns',
        el('button', { type: 'button', class: 'btn btn-navy', text: 'อนุมัติ', onclick: () => approve(l) }),
        el('button', { type: 'button', class: 'btn btn-danger', text: 'ปฏิเสธ', onclick: () => reject(l, reason.value.trim()) })));
    } else {
      nodes.push(el('p', { style: 'margin-top:12px;' }, 'สถานะ: ', qa.pill(LISTING_STATUS, l.status)));
      if (l.rejectReason) nodes.push(el('p', { class: 'muted', text: `เหตุผลที่ไม่อนุมัติ: ${l.rejectReason}` }));
    }
    $('panel').replaceChildren(...nodes);
  }

  async function afterAction(message) {
    qa.alertBox($('alert-area'), message, 'success');
    await Promise.all([loadList(), loadPendingCount()]);
    await select(state.selected);
  }

  function approve(l) {
    qa.modal({
      title: 'อนุมัติสินค้า',
      body: el('p', { text: `"${l.title}" จะเริ่มประมูลทันทีและสิ้นสุดใน ${l.durationDays} วัน แก้ไขไม่ได้หลังอนุมัติ` }),
      confirmText: 'ยืนยันอนุมัติ',
      confirmClass: 'btn-navy',
      onConfirm: async () => {
        await api.post(`/admin/listings/${l.id}/approve`);
        await afterAction('อนุมัติสินค้าแล้ว เริ่มประมูลทันที');
      },
    });
  }

  // Modal ปฏิเสธสินค้า: เลือกเหตุผลด่วน + อธิบายเพิ่ม (BE บังคับ 5–500 ตัวอักษร)
  function reject(l, prefill) {
    const chosen = new Set();
    const chips = el('div', { class: 'qa-reason-chips', role: 'group', 'aria-label': 'เหตุผลด่วน' },
      ...REASONS.map((r) => {
        const b = el('button', { type: 'button', 'aria-pressed': 'false', text: r });
        b.addEventListener('click', () => {
          if (chosen.has(r)) chosen.delete(r); else chosen.add(r);
          b.setAttribute('aria-pressed', String(chosen.has(r)));
        });
        return b;
      }));
    const input = el('input', { type: 'text', id: 'reject-reason', maxlength: 400, placeholder: 'อธิบายสิ่งที่ต้องแก้ไข เช่น ถ่ายรูปฟิกเกอร์ใหม่ให้เห็นกล่องและฐาน' });
    input.value = prefill || '';
    const err = el('span', { class: 'field-error', id: 'err-reason' });
    qa.modal({
      title: 'ปฏิเสธสินค้า',
      body: el('div', {},
        el('p', { class: 'muted', style: 'margin:0;', text: 'ระบุเหตุผล ระบบจะส่งกลับให้ผู้ขายแก้ไขและส่งตรวจใหม่' }),
        chips,
        el('div', 'form-group',
          el('label', { for: 'reject-reason', text: 'เหตุผล (บังคับกรอก)' }), input,
          el('span', { class: 'hint', text: 'ผู้ใช้จะได้รับเหตุผลนี้ทางแจ้งเตือนและอีเมล' }), err)),
      confirmText: 'ยืนยันปฏิเสธ',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const detail = input.value.trim();
        const reason = [[...chosen].join(', '), detail].filter(Boolean).join(' — ');
        if (reason.length < 5) {
          err.textContent = 'กรุณาเลือกเหตุผลหรืออธิบายอย่างน้อย 5 ตัวอักษร';
          throw new Error('กรุณาระบุเหตุผลการปฏิเสธ');
        }
        await api.post(`/admin/listings/${l.id}/reject`, { reason: reason.slice(0, 500) });
        await afterAction('ปฏิเสธสินค้าแล้ว ส่งเหตุผลให้ผู้ขาย');
      },
    });
  }

  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!qa.requireAdmin(user)) return;
    $('chips').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.status = b.dataset.status;
      state.page = 1;
      $('chips').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
      loadList();
    }));
    loadPendingCount();
    loadList();
    const pre = Number(qa.qs('id'));
    if (pre) select(pre);
  });
})();
