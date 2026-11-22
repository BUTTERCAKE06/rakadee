// qa-common.js — ตัวช่วยที่หน้าของโมดูล QA ใช้ร่วมกัน (เจ้าของ: QA)
// โหลดหลัง /js/api.js · ใส่ข้อความจากผู้ใช้ด้วย textContent เท่านั้น (ฟังก์ชัน el ทำให้)
'use strict';

const qa = (() => {
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (typeof attrs === 'string') e.className = attrs;
    else if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    children.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return e;
  }

  const money = (n) => (n === null || n === undefined ? '-'
    : `฿${Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '-');
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-');
  const qs = (name) => new URLSearchParams(location.search).get(name);
  const disputeCode = (id) => `#DSP-${String(id).padStart(4, '0')}`;
  const orderCode = (id) => `#ORD-${id}`;

  // ป้ายสถานะ
  const DISPUTE_STATUS = {
    open: ['เปิดข้อพิพาท', 'is-info'],
    awaiting_evidence: ['รอหลักฐาน', 'is-warning'],
    investigating: ['กำลังตรวจสอบ', 'is-warning'],
    return_in_progress: ['ดำเนินการคืนสินค้า', 'is-info'],
    refund_in_progress: ['ดำเนินการคืนเงิน', 'is-info'],
    closed: ['สิ้นสุด', 'is-success'],
  };
  // ป้ายสถานะที่ผู้ขายเห็น (ภาพ 38): ข้อพิพาทที่เพิ่งเปิดแสดงเป็น "กำลังตรวจสอบ" สีเหลือง
  // หน้าแอดมินและ stepper ของผู้ซื้อยังใช้ชื่อสถานะตามข้อ 1.7-7 (DISPUTE_STATUS)
  const DISPUTE_STATUS_SELLER = { ...DISPUTE_STATUS, open: ['กำลังตรวจสอบ', 'is-warning'] };
  const DISPUTE_STEPS =['open', 'awaiting_evidence', 'investigating', 'return_in_progress', 'refund_in_progress', 'closed'];
  const DISPUTE_TYPE = {
    not_received: 'ไม่ได้รับสินค้า',
    not_as_described: 'สินค้าไม่ตรงปก',
    damaged: 'สินค้าชำรุด / เสียหาย',
    other: 'อื่นๆ',
  };
  const RESOLUTION = { refund_buyer: 'คืนเงินผู้ซื้อ', release_seller: 'ปล่อยเงินให้ผู้ขาย' };
  const USER_STATUS = {
    pending_verification: ['รอยืนยันตัวตน', ''],
    active: ['ปกติ', 'is-success'],
    restricted: ['ถูกจำกัด', 'is-warning'],
    suspended: ['ระงับชั่วคราว', 'is-warning'],
    banned: ['แบนถาวร', 'is-danger'],
  };
  const ROLE = { bidder: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'Admin', super_admin: 'Super Admin' };
  const SHOP_STATUS = {
    pending: ['รออนุมัติ', 'is-warning'],
    approved: ['อนุมัติแล้ว', 'is-success'],
    rejected: ['ไม่อนุมัติ', 'is-danger'],
  };
  const PENALTY_TYPE = {
    non_payment: 'ชนะแล้วไม่ชำระเงิน', no_shipment: 'ไม่จัดส่งสินค้า', shill_bidding: 'ปั่นราคา', admin_ban: 'แบนโดยแอดมิน',
  };
  const PENALTY_ACTION = { warning: 'เตือน', restrict: 'จำกัดสิทธิ์', suspend: 'ระงับชั่วคราว', ban: 'แบนถาวร' };
  // ชื่อสถานะตามข้อ 1.7-3 และ 1.7-6 (D-08: disputed = อยู่ระหว่างตรวจสอบข้อพิพาท)
  const ORDER_STATUS = {
    pending_payment: 'รอการชำระเงิน',
    awaiting_shipment: 'รอการจัดส่ง',
    shipped: 'อยู่ระหว่างจัดส่ง',
    completed: 'จัดส่งสำเร็จ',
    disputed: 'อยู่ระหว่างตรวจสอบข้อพิพาท',
    cancelled: 'ยกเลิก',
  };
  const ESCROW_STATUS = { held: 'พักเงินไว้ (held)', released: 'ปล่อยเงินแล้ว (released)', refunded: 'คืนเงินแล้ว (refunded)' };
  const label = (map, key) => map[key] || key || '-';
  const ORDER_EVENT = {
    order_created: 'ชนะประมูล / สร้างคำสั่งซื้อ',
    paid: 'ชำระเงิน → เงินเข้า Escrow',
    shipped: 'ผู้ขายส่งของ',
    completed: 'คำสั่งซื้อสำเร็จ',
    cancelled: 'ยกเลิกคำสั่งซื้อ',
  };

  function pill(map, key) {
    const [label, cls] = map[key] || [key, ''];
    return el('span', `qa-pill ${cls}`, label);
  }

  function alertBox(host, message, type = 'error') {
    if (!host) return;
    host.replaceChildren(message ? el('div', { class: `alert alert-${type}`, role: 'alert', text: message }) : '');
  }

  // แสดง details ของ VALIDATION_ERROR ที่ช่อง id="err-<field>" (ถ้ามี) คืนค่า true ถ้าแสดงได้อย่างน้อย 1 ช่อง
  function fieldErrors(details) {
    let shown = false;
    Object.entries(details || {}).forEach(([k, v]) => {
      const e = document.getElementById(`err-${k}`);
      if (e) { e.textContent = v; shown = true; }
    });
    return shown;
  }
  function clearFieldErrors(root = document) {
    root.querySelectorAll('.field-error').forEach((e) => { e.textContent = ''; });
  }

  // รูปหลักฐาน: ถ้าโหลดรูปไม่ได้ให้แสดงไอคอนแทน
  function thumb(url, title) {
    const box = el('div', { class: 'qa-thumb', title: title || '' });
    if (!url) { box.textContent = '🖼'; return box; }
    // ไฟล์ที่ตรวจสิทธิ์ (/api/...) ต้องแนบ token จึงโหลดผ่าน api.blob() แล้วใช้ object URL
    if (url.startsWith('/api/')) {
      box.textContent = '…';
      api.blob(url.slice(4)).then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const img = el('img', { src: objUrl, alt: title || 'หลักฐาน' });
        box.replaceChildren(el('a', { href: objUrl, target: '_blank', rel: 'noopener' }, img));
      }).catch(() => { box.replaceChildren('🖼'); });
      return box;
    }
    const img = el('img', { src: url, alt: title || 'หลักฐาน', loading: 'lazy' });
    img.addEventListener('error', () => { box.replaceChildren('🖼'); });
    box.append(el('a', { href: url, target: '_blank', rel: 'noopener' }, img));
    return box;
  }

  // ตัวเลือกไฟล์รูปหลายไฟล์ + preview (jpg/png ≤ 5MB ตาม upload.js)
  function filePicker({ drop, input, preview, max = 5, onChange }) {
    let files = [];
    const MAX_MB = 5;
    const render = () => {
      preview.replaceChildren(...files.map((f, i) => {
        const box = el('div', 'qa-thumb');
        const url = URL.createObjectURL(f);
        box.append(el('img', { src: url, alt: f.name }));
        box.append(el('button', { type: 'button', 'aria-label': `ลบ ${f.name}`, text: '×', onclick: () => { files.splice(i, 1); render(); } }));
        return box;
      }));
      if (onChange) onChange(files);
    };
    const add = (list) => {
      const errors = [];
      [...list].forEach((f) => {
        if (!['image/jpeg', 'image/png'].includes(f.type)) errors.push(`${f.name}: รองรับเฉพาะ .jpg .jpeg .png`);
        else if (f.size > MAX_MB * 1024 * 1024) errors.push(`${f.name}: ไฟล์ต้องไม่เกิน ${MAX_MB} MB`);
        else if (files.length >= max) errors.push(`แนบได้ไม่เกิน ${max} รูป`);
        else files.push(f);
      });
      render();
      return errors;
    };
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    const picker = {
      get files() { return files; },
      clear() { files = []; render(); },
      onError: null,
    };
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      const errs = add(e.dataTransfer.files);
      if (picker.onError) picker.onError(errs);
    });
    input.addEventListener('change', () => {
      const errs = add(input.files);
      input.value = '';
      if (picker.onError) picker.onError(errs);
    });
    return picker;
  }

  // Modal: qa.modal({ title, body: Node, confirmText, confirmClass, onConfirm: async () => {} })
  // onConfirm throw ApiError → แสดงข้อความในกล่อง (ไม่ปิด)
  function modal({ title, body, confirmText = 'ยืนยัน', confirmClass = 'btn-primary', onConfirm }) {
    const msg = el('div');
    const btnOk = el('button', { type: 'button', class: `btn ${confirmClass}`, text: confirmText });
    const btnCancel = el('button', { type: 'button', class: 'btn', text: 'ยกเลิก' });
    const btnX = el('button', { type: 'button', class: 'qa-modal-close', 'aria-label': 'ปิด', text: '×' });
    const box = el('div', { class: 'qa-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', 'qa-modal-head', el('h3', { text: title }), btnX), msg, body, el('div', 'qa-modal-actions', btnCancel, btnOk));
    const backdrop = el('div', 'qa-modal-backdrop', box);
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    btnX.addEventListener('click', close);
    btnCancel.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
    btnOk.addEventListener('click', async () => {
      btnOk.disabled = true;
      alertBox(msg, '');
      try {
        await onConfirm();
        close();
      } catch (err) {
        alertBox(msg, err.message || 'เกิดข้อผิดพลาด');
        if (err.details) fieldErrors(err.details);
      } finally {
        btnOk.disabled = false;
      }
    });
    document.body.append(backdrop);
    const first = box.querySelector('input, textarea, select');
    (first || btnOk).focus();
    return { close };
  }

  // ปุ่มแบ่งหน้า
  function pagination(host, { page, limit, total }, onPage) {
    const pages = Math.max(1, Math.ceil(total / limit));
    if (pages <= 1) { host.replaceChildren(); return; }
    host.replaceChildren(
      el('button', { class: 'btn', type: 'button', disabled: page <= 1, text: '‹ ก่อนหน้า', onclick: () => onPage(page - 1) }),
      el('span', { class: 'muted', text: `หน้า ${page} / ${pages}` }),
      el('button', { class: 'btn', type: 'button', disabled: page >= pages, text: 'ถัดไป ›', onclick: () => onPage(page + 1) }),
    );
  }

  // ระยะเวลาประมูลของสินค้าของฉัน: 5.2 (Programmer) ยังไม่ส่ง durationDays จึงหาจาก 4.9 /seller/listings
  // TODO: ลบเมื่อ 5.2 ส่ง durationDays ให้เจ้าของสินค้า
  async function ownerDurationDays(listingId, status) {
    for (let page = 1; page <= 20; page += 1) {
      const d = await api.get(`/seller/listings?status=${encodeURIComponent(status || '')}&limit=50&page=${page}`);
      const found = d.items.find((l) => l.id === listingId);
      if (found) return found.durationDays;
      if (page * d.limit >= d.total) return null;
    }
    return null;
  }

  // หน้าแอดมิน: ยังไม่ login → หน้า login (กลับมาหน้าเดิมได้) · login แล้วแต่ไม่ใช่แอดมิน → หน้าแรก
  // คืน true ถ้าเป็นแอดมิน (BE ตรวจสิทธิ์ซ้ำทุก API อยู่แล้ว)
  function requireAdmin(user) {
    if (!user) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return false; }
    if (!['admin', 'super_admin'].includes(user.role)) { location.href = '/'; return false; }
    return true;
  }

  return {
    el, money, dateTime, date, qs, disputeCode, orderCode, pill, alertBox, fieldErrors, clearFieldErrors, ownerDurationDays, requireAdmin,
    thumb, filePicker, modal, pagination,
    DISPUTE_STATUS, DISPUTE_STATUS_SELLER, DISPUTE_STEPS, DISPUTE_TYPE, RESOLUTION, USER_STATUS, ROLE, SHOP_STATUS,
    PENALTY_TYPE, PENALTY_ACTION, ORDER_EVENT, ORDER_STATUS, ESCROW_STATUS, label,
  };
})();
