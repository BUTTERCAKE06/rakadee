// แสดงรายละเอียดคำสั่งซื้อ (api-spec 8.2) ใช้ร่วมกันในหน้า orders.html และ admin/orders.html — เจ้าของ: PM
// ใช้: OrderView.mount(container, orderId, { backHref })  → โหลด GET /api/orders/:id แล้ววาดหน้า พร้อมปุ่มตามสิทธิ์
//   ผู้ซื้อ: ชำระเงิน, ยืนยันรับ (8.5), ขอยกเลิกเมื่อเลยกำหนดส่ง (8.6), แจ้งปัญหา
//   ผู้ขาย: ฟอร์มบันทึกการจัดส่ง (8.4)    แอดมิน: ดูอย่างเดียว
// countdown ใช้เวลาจาก server (serverTime ใน response) ไม่ใช้นาฬิกาเครื่อง
window.OrderView = (() => {
  // หน้าของโมดูลอื่น ถ้าเจ้าของตั้งชื่อหน้าต่างไปแก้ที่นี่ที่เดียว
  const PAY_URL = (id) => `/pages/payment.html?orderId=${id}`; // SA: หน้าชำระเงิน (api-spec 7.4)
  const DISPUTE_URL = (id) => `/pages/disputes.html?orderId=${id}`; // QA: ฟอร์มเปิดข้อพิพาท (api-spec 9)

  const STATUS = {
    pending_payment: ['รอชำระเงิน', 'badge-warning'],
    awaiting_shipment: ['รอจัดส่ง', 'badge-info'],
    shipped: ['อยู่ระหว่างจัดส่ง', 'badge-info'],
    completed: ['สำเร็จ', 'badge-success'],
    disputed: ['มีข้อพิพาท', 'badge-danger'],
    cancelled: ['ยกเลิก', ''],
  };
  const TIMELINE = {
    order_created: 'สร้างคำสั่งซื้อ',
    payment_submitted: 'ผู้ซื้อชำระเงิน รอแอดมินตรวจ',
    payment_rejected: 'แอดมินปฏิเสธการชำระเงิน',
    paid: 'ชำระเงินสำเร็จ เงินพักไว้ที่ระบบ',
    shipped: 'ผู้ขายบันทึกการจัดส่ง',
    dispute_opened: 'เปิดข้อพิพาท',
    dispute_resolved: 'แอดมินตัดสินข้อพิพาท',
    funds_released: 'ปล่อยเงินให้ผู้ขาย',
    refunded: 'คืนเงินให้ผู้ซื้อ',
    completed: 'คำสั่งซื้อสำเร็จ',
    cancelled: 'ยกเลิกคำสั่งซื้อ',
  };
  const CANCEL_REASON = {
    payment_timeout: 'ผู้ซื้อไม่ชำระเงินภายในกำหนด',
    seller_no_shipment: 'ผู้ขายไม่จัดส่งภายในกำหนด',
    dispute_refund: 'คืนเงินจากการตัดสินข้อพิพาท',
  };
  const CARRIERS = [
    ['thailand_post', 'ไปรษณีย์ไทย'], ['kerry', 'Kerry Express'], ['flash', 'Flash Express'], ['jt', 'J&T Express'], ['other', 'อื่นๆ'],
  ];
  const ESCROW = { held: 'พักไว้ที่ระบบ', released: 'ปล่อยให้ผู้ขายแล้ว', refunded: 'คืนผู้ซื้อแล้ว' };
  const PAYMENT = { pending_review: 'รอแอดมินตรวจ', success: 'สำเร็จ', rejected: 'ถูกปฏิเสธ' };

  const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const when = (v) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
  const code = (id) => `#ORD-${id}`;

  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    children.flat().forEach((c) => { if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c)); });
    return e;
  }

  function statusBadge(status) {
    const [label, cls] = STATUS[status] || [status, ''];
    return h('span', { class: `badge ${cls}`, text: label });
  }

  function thumb(url) {
    return url ? h('img', { class: 'order-thumb', src: url, alt: '' }) : h('div', { class: 'order-thumb', 'aria-hidden': 'true' });
  }

  function rows(pairs) {
    const dl = h('dl', { class: 'ov-rows' });
    pairs.filter(Boolean).forEach(([k, v, cls]) => dl.append(h('dt', { class: cls }, k), h('dd', { class: cls }, v)));
    return dl;
  }

  function alertBox(host, message, type = 'error') {
    host.replaceChildren();
    if (message) host.append(h('div', { class: `alert alert-${type}`, role: 'alert', text: message }));
  }

  // ---------------------------------------------------------------- countdown (เวลาจาก server)
  let offset = 0;
  let ticker = null;
  const nowServer = () => Date.now() + offset;
  function countdownText(target) {
    const sec = Math.floor((new Date(target).getTime() - nowServer()) / 1000);
    if (sec <= 0) return 'หมดเวลาแล้ว';
    const d = Math.floor(sec / 86400);
    const hh = Math.floor((sec % 86400) / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    if (d) return `${d} วัน ${hh} ชม. ${mm} นาที`;
    return `${hh} ชม. ${String(mm).padStart(2, '0')} นาที ${String(ss).padStart(2, '0')} วินาที`;
  }
  function countdown(target) {
    return h('span', { class: 'ov-countdown', 'data-until': target, text: countdownText(target) });
  }
  function startTicker(root) {
    clearInterval(ticker);
    ticker = setInterval(() => {
      root.querySelectorAll('[data-until]').forEach((el) => { el.textContent = countdownText(el.dataset.until); });
    }, 1000);
  }

  // ---------------------------------------------------------------- กล่อง "ขั้นต่อไป" ตามสถานะและบทบาท
  function nextStep(o, ctx) {
    const r = o.viewerRole;
    const actions = [];
    let tone = 'muted';
    let title = '';
    let body = [];

    const disputeOpen = o.dispute && o.dispute.status !== 'closed';
    if (disputeOpen) {
      tone = 'warn';
      title = 'มีข้อพิพาทที่ยังไม่ปิด';
      body = ['เงินถูกพักไว้ที่ระบบจนกว่าแอดมินจะตัดสิน ระบบจะไม่ปล่อยเงินอัตโนมัติระหว่างนี้'];
    } else if (o.status === 'pending_payment') {
      const reviewing = o.payment && o.payment.status === 'pending_review';
      if (reviewing) {
        tone = 'muted';
        title = 'รอแอดมินตรวจการชำระเงิน';
        body = [r === 'buyer' ? 'ชำระแล้ว แอดมินจะตรวจภายใน 24 ชม. นาฬิกากำหนดชำระหยุดนับระหว่างนี้' : 'ผู้ซื้อชำระแล้ว รอแอดมินตรวจ'];
      } else {
        tone = r === 'buyer' ? 'action' : 'muted';
        title = r === 'buyer' ? 'ชำระเงินเพื่อยืนยันคำสั่งซื้อ' : 'รอผู้ซื้อชำระเงิน';
        body = ['เหลือเวลาชำระ ', countdown(o.paymentDueAt)];
        if (o.payment && o.payment.status === 'rejected') {
          body.push(h('br'), `การชำระครั้งก่อนถูกปฏิเสธ: ${o.payment.rejectReason || '-'}`);
        }
        if (o.canPay) actions.push(h('a', { class: 'btn btn-primary', href: PAY_URL(o.id), text: `ชำระเงิน ${baht(o.totalAmount)}` }));
      }
    } else if (o.status === 'awaiting_shipment') {
      if (r === 'seller') {
        tone = o.shipOverdue ? 'warn' : 'action';
        title = o.shipOverdue ? 'เลยกำหนดส่งแล้ว รีบบันทึกการจัดส่ง' : 'จัดส่งสินค้าและบันทึกเลขพัสดุ';
        body = o.shipOverdue
          ? ['ผู้ซื้อขอยกเลิกและรับเงินคืนได้ทุกเมื่อ ถ้ายกเลิก บัญชีของคุณจะถูกบันทึกความผิด']
          : ['ต้องบันทึกภายใน ', countdown(o.shipDueAt)];
      } else if (r === 'buyer') {
        tone = o.shipOverdue ? 'warn' : 'muted';
        title = o.shipOverdue ? 'ผู้ขายยังไม่จัดส่งตามกำหนด' : 'รอผู้ขายจัดส่ง';
        body = o.shipOverdue
          ? ['คุณขอยกเลิกและรับเงินคืนเต็มจำนวนเข้า Mock Wallet ได้']
          : ['ผู้ขายต้องจัดส่งภายใน ', countdown(o.shipDueAt), ' เงินของคุณพักไว้ที่ระบบจนกว่าจะได้รับของ'];
        if (o.canCancel) actions.push(h('button', { type: 'button', class: 'btn btn-danger', text: 'ขอยกเลิกและรับเงินคืน', onclick: () => ctx.openCancel() }));
      } else {
        title = 'รอผู้ขายจัดส่ง';
        body = ['กำหนดส่ง ', when(o.shipDueAt), o.shipOverdue ? h('span', { class: 'overdue', text: ' (เลยกำหนด)' }) : ''];
      }
    } else if (o.status === 'shipped') {
      tone = r === 'buyer' ? 'action' : 'muted';
      title = r === 'buyer' ? 'ได้รับสินค้าแล้วหรือยัง' : 'สินค้าอยู่ระหว่างจัดส่ง';
      body = [r === 'buyer'
        ? 'ตรวจสินค้าแล้วกดยืนยันรับ ระบบจะปล่อยเงินให้ผู้ขาย ถ้าไม่กด ระบบปล่อยเงินอัตโนมัติใน '
        : 'ระบบปล่อยเงินให้ผู้ขายเมื่อผู้ซื้อยืนยันรับ หรืออัตโนมัติใน ', countdown(o.autoReleaseAt)];
      if (o.canConfirmReceipt) actions.push(h('button', { type: 'button', class: 'btn btn-primary', text: 'ยืนยันรับสินค้า', onclick: () => ctx.openConfirm() }));
    } else if (o.status === 'completed') {
      tone = 'done';
      title = 'คำสั่งซื้อสำเร็จ';
      body = [r === 'seller' && o.escrow && o.escrow.netAmount !== null
        ? `ได้รับเงิน ${baht(o.escrow.netAmount)} เข้า Mock Wallet แล้ว (หักค่าธรรมเนียม ${baht(o.escrow.feeAmount)})`
        : `ปิดคำสั่งซื้อเมื่อ ${when(o.completedAt)}`];
    } else if (o.status === 'cancelled') {
      title = 'คำสั่งซื้อถูกยกเลิก';
      body = [CANCEL_REASON[o.cancelReason] || 'ยกเลิกแล้ว', o.escrow && o.escrow.status === 'refunded' ? ` · คืนเงิน ${baht(o.escrow.amount)} เข้า Mock Wallet ของผู้ซื้อแล้ว` : ''];
    } else if (o.status === 'disputed') {
      tone = 'warn';
      title = 'อยู่ระหว่างตรวจสอบข้อพิพาท';
      body = ['เงินถูกพักไว้จนกว่าแอดมินจะตัดสิน'];
    }

    if (o.canOpenDispute) actions.push(h('a', { class: 'btn', href: DISPUTE_URL(o.id), text: 'แจ้งปัญหา' }));
    if (o.dispute) actions.push(h('a', { class: 'btn', href: `/pages/disputes.html?id=${o.dispute.id}`, text: 'ดูข้อพิพาท' }));

    return h('section', { class: `ov-next tone-${tone}`, 'aria-live': 'polite' },
      h('h2', { text: title }), h('p', null, ...body), actions.length ? h('div', { class: 'ov-actions' }, ...actions) : null);
  }

  // ---------------------------------------------------------------- ฟอร์มบันทึกการจัดส่ง (ผู้ขาย, 8.4)
  function localInputValue(date) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function shipForm(o, reload) {
    const msg = h('div');
    const carrier = h('select', { id: 'carrier', name: 'carrier', required: true },
      h('option', { value: '', text: 'เลือกผู้ให้บริการ' }), ...CARRIERS.map(([v, l]) => h('option', { value: v, text: l })));
    const other = h('input', { id: 'carrierOther', name: 'carrierOther', maxlength: '100' });
    const otherGroup = h('div', { class: 'form-group', hidden: true }, h('label', { for: 'carrierOther', text: 'ชื่อผู้ให้บริการ' }), other);
    carrier.addEventListener('change', () => { otherGroup.hidden = carrier.value !== 'other'; });
    const tracking = h('input', { id: 'trackingNumber', name: 'trackingNumber', required: true, maxlength: '40', autocomplete: 'off', placeholder: 'เช่น TH1234567890' });
    const shippedAt = h('input', { id: 'shippedAt', name: 'shippedAt', type: 'datetime-local', required: true, value: localInputValue(new Date()) });
    const proof = h('input', { id: 'proof', name: 'proof', type: 'file', accept: 'image/jpeg,image/png' });
    const note = h('textarea', { id: 'note', name: 'note', maxlength: '500', rows: '2' });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary', text: 'บันทึกการจัดส่ง' });
    const err = {};
    const field = (label, input, hint, key, full) => {
      err[key] = h('div', { class: 'field-error', id: `${key}-error` });
      input.setAttribute('aria-describedby', `${key}-error`);
      return h('div', { class: `form-group${full ? ' full' : ''}` }, h('label', { for: input.id, text: label }), input,
        hint ? h('span', { class: 'hint', text: hint }) : null, err[key]);
    };

    const form = h('form', { class: 'ov-card ov-ship-form', id: 'ship', novalidate: true },
      h('h3', { text: 'บันทึกการจัดส่ง' }),
      h('p', { class: 'hint', text: 'บันทึกแล้วผู้ซื้อจะได้รับแจ้งพร้อมเลขพัสดุ และนับ 7 วันก่อนปล่อยเงินอัตโนมัติ' }),
      msg,
      h('div', { class: 'form-grid' },
        field('ผู้ให้บริการขนส่ง', carrier, null, 'carrier'),
        field('เลขพัสดุ', tracking, null, 'trackingNumber'),
        otherGroup,
        field('วันเวลาที่ส่ง', shippedAt, null, 'shippedAt'),
        field('หลักฐานการส่ง (ไม่บังคับ)', proof, 'รูปใบเสร็จหรือพัสดุ .jpg/.png ไม่เกิน 5MB', 'proof'),
        field('หมายเหตุ (ไม่บังคับ)', note, null, 'note', true)),
      h('div', { class: 'ov-actions' }, submit));
    err.carrierOther = h('div', { class: 'field-error' });
    otherGroup.append(err.carrierOther);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Object.values(err).forEach((x) => { x.textContent = ''; });
      alertBox(msg, '');
      const errors = {};
      const tn = tracking.value.trim().toUpperCase();
      if (!carrier.value) errors.carrier = 'กรุณาเลือกผู้ให้บริการขนส่ง';
      if (carrier.value === 'other' && !other.value.trim()) errors.carrierOther = 'กรุณาระบุชื่อผู้ให้บริการขนส่ง';
      if (!tn) errors.trackingNumber = 'กรุณากรอกเลขพัสดุ';
      else if (!/^[A-Z0-9-]{6,40}$/.test(tn)) errors.trackingNumber = 'ตัวอักษรอังกฤษหรือตัวเลข 6–40 ตัว';
      const at = shippedAt.value ? new Date(shippedAt.value) : null;
      if (!at || Number.isNaN(at.getTime())) errors.shippedAt = 'กรุณาระบุวันเวลาที่ส่ง';
      else if (at.getTime() > nowServer() + 5 * 60000) errors.shippedAt = 'วันเวลาที่ส่งต้องไม่เป็นเวลาในอนาคต';
      const file = proof.files[0];
      if (file && !['image/jpeg', 'image/png'].includes(file.type)) errors.proof = 'รองรับเฉพาะไฟล์ .jpg และ .png';
      else if (file && file.size > 5 * 1024 * 1024) errors.proof = 'ไฟล์ต้องไม่เกิน 5MB';
      if (Object.keys(errors).length) {
        Object.entries(errors).forEach(([k, v]) => { if (err[k]) err[k].textContent = v; });
        return;
      }
      const fd = new FormData();
      fd.append('carrier', carrier.value);
      if (carrier.value === 'other') fd.append('carrierOther', other.value.trim());
      fd.append('trackingNumber', tn);
      fd.append('shippedAt', at.toISOString());
      if (note.value.trim()) fd.append('note', note.value.trim());
      if (file) fd.append('proof', file);
      submit.disabled = true;
      try {
        await api.upload(`/orders/${o.id}/shipment`, fd);
        reload('บันทึกการจัดส่งแล้ว แจ้งผู้ซื้อพร้อมเลขพัสดุเรียบร้อย');
      } catch (ex) {
        if (ex.details) Object.entries(ex.details).forEach(([k, v]) => { if (err[k]) err[k].textContent = v; });
        alertBox(msg, ex.message);
        submit.disabled = false;
      }
    });
    return form;
  }

  // ---------------------------------------------------------------- dialog ยืนยัน
  function dialog({ title, text, confirmLabel, danger, withReason, onConfirm }) {
    const reason = withReason ? h('textarea', { id: 'dlg-reason', maxlength: '300', placeholder: 'เช่น ผู้ขายไม่ส่งของตามกำหนด' }) : null;
    const msg = h('div');
    const ok = h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: confirmLabel });
    const cancel = h('button', { type: 'button', class: 'btn', text: 'ยกเลิก' });
    const dlg = h('dialog', { class: 'ov-dialog', 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title', text: title }), h('p', { text }), msg,
      reason ? h('div', { class: 'form-group' }, h('label', { for: 'dlg-reason', text: 'เหตุผล (ไม่บังคับ)' }), reason) : null,
      h('div', { class: 'ov-actions' }, ok, cancel));
    cancel.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      try {
        await onConfirm(reason ? reason.value.trim() : undefined);
        dlg.close();
      } catch (ex) {
        alertBox(msg, ex.message);
        ok.disabled = false;
      }
    });
    document.body.append(dlg);
    dlg.showModal();
  }

  // ---------------------------------------------------------------- วาดทั้งหน้า
  function render(root, o, opts, reload) {
    offset = new Date(o.serverTime).getTime() - Date.now();
    const ctx = {
      openConfirm: () => dialog({
        title: 'ยืนยันรับสินค้า',
        text: `เมื่อยืนยันแล้ว ระบบจะปล่อยเงินให้ผู้ขายทันทีและยกเลิกไม่ได้ ตรวจสินค้าให้เรียบร้อยก่อนกด`,
        confirmLabel: 'ยืนยันรับสินค้า',
        onConfirm: async () => { await api.post(`/orders/${o.id}/confirm-receipt`); reload('ยืนยันรับสินค้าแล้ว ปล่อยเงินให้ผู้ขายเรียบร้อย'); },
      }),
      openCancel: () => dialog({
        title: 'ขอยกเลิกและรับเงินคืน',
        text: `ระบบจะคืนเงิน ${baht(o.totalAmount)} เข้า Mock Wallet ของคุณทันที และบันทึกความผิดของผู้ขาย`,
        confirmLabel: 'ยกเลิกคำสั่งซื้อ',
        danger: true,
        withReason: true,
        onConfirm: async (reason) => { await api.post(`/orders/${o.id}/cancel`, { reason }); reload('ยกเลิกคำสั่งซื้อแล้ว คืนเงินเข้า Mock Wallet เรียบร้อย'); },
      }),
    };

    const addr = o.shippingAddress;
    const addressText = addr
      ? `${addr.recipientName} · ${addr.phone}\n${addr.addressLine} ${addr.subDistrict} ${addr.district}\n${addr.province} ${addr.postalCode}`
      : null;

    const left = [
      h('section', { class: 'ov-card' }, h('h3', { text: 'สินค้า' }),
        h('div', { class: 'ov-product' }, thumb(o.listing.coverUrl),
          h('div', null, h('a', { href: `/pages/listing.html?id=${o.listing.id}`, text: o.listing.title }),
            h('div', { class: 'muted', text: o.closingType === 'buy_now' ? 'ซื้อทันที' : 'ชนะการประมูล' }))),
        rows([
          ['ราคาสินค้า', baht(o.itemPrice)],
          ['ค่าจัดส่ง', o.shippingFee ? baht(o.shippingFee) : 'ส่งฟรี'],
          ['ยอดรวม', baht(o.totalAmount), 'total'],
        ])),
      h('section', { class: 'ov-card' }, h('h3', { text: 'ผู้ซื้อและผู้ขาย' }),
        rows([['ผู้ซื้อ', o.buyer.displayName], ['ผู้ขาย', h('a', { href: `/pages/seller-profile.html?id=${o.seller.id}`, text: o.seller.displayName })]])),
      h('section', { class: 'ov-card' }, h('h3', { text: 'ที่อยู่จัดส่ง' }),
        addressText ? h('p', { class: 'ov-address', text: addressText })
          : h('p', { class: 'muted', text: o.viewerRole === 'seller' ? 'แสดงหลังผู้ซื้อชำระเงินสำเร็จ' : 'ยังไม่มีที่อยู่ กรุณาเลือกที่อยู่ก่อนชำระเงิน' })),
    ];

    const shipCard = h('section', { class: 'ov-card' }, h('h3', { text: 'การจัดส่ง' }));
    if (o.shipment) {
      const s = o.shipment;
      shipCard.append(rows([
        ['ผู้ให้บริการ', s.carrierLabel || s.carrier],
        ['เลขพัสดุ', h('strong', { text: s.trackingNumber })],
        ['วันเวลาที่ส่ง', when(s.shippedAt)],
        s.note ? ['หมายเหตุ', s.note] : null,
      ]));
      if (s.proofUrl) {
        const box = h('div', { class: 'ov-proof' });
        const btn = h('button', { type: 'button', class: 'btn', text: 'ดูหลักฐานการส่ง' });
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const url = URL.createObjectURL(await api.blob(s.proofUrl.replace(/^\/api/, '')));
            box.replaceChildren(h('img', { src: url, alt: 'หลักฐานการจัดส่ง' }));
          } catch (ex) {
            box.replaceChildren(h('div', { class: 'field-error', text: ex.message }));
            btn.disabled = false;
          }
        });
        shipCard.append(h('div', { class: 'ov-actions' }, btn), box);
      }
    } else {
      shipCard.append(rows([
        ['กำหนดส่ง', o.shipDueAt ? when(o.shipDueAt) : 'นับหลังชำระเงินสำเร็จ'],
      ]));
    }

    const money = h('section', { class: 'ov-card' }, h('h3', { text: 'การชำระเงินและเงินพัก' }),
      rows([
        ['การชำระเงิน', o.payment ? PAYMENT[o.payment.status] || o.payment.status : 'ยังไม่ชำระ'],
        o.paidAt ? ['ชำระสำเร็จเมื่อ', when(o.paidAt)] : null,
        ['เงินพัก (Escrow)', o.escrow ? `${ESCROW[o.escrow.status] || o.escrow.status} ${baht(o.escrow.amount)}` : '-'],
        o.escrow && o.escrow.feeAmount !== null && o.viewerRole !== 'buyer' ? ['ค่าธรรมเนียม', baht(o.escrow.feeAmount)] : null,
        o.escrow && o.escrow.netAmount !== null && o.viewerRole !== 'buyer' ? ['ผู้ขายได้รับ', baht(o.escrow.netAmount)] : null,
      ]));

    const timeline = h('section', { class: 'ov-card' }, h('h3', { text: 'ไทม์ไลน์' }),
      h('ol', { class: 'ov-timeline' }, ...o.timeline.map((t) => h('li', null,
        h('div', { text: TIMELINE[t.event] || t.event }),
        h('div', { class: 'when', text: when(t.at) }),
        t.note ? h('div', { class: 'note', text: CANCEL_REASON[t.note] || t.note }) : null))));

    root.replaceChildren(...[
      opts.backHref ? h('a', { class: 'ov-back', href: opts.backHref, text: '← กลับไปรายการคำสั่งซื้อ' }) : null,
      h('div', { id: 'ov-alert' }),
      h('div', { class: 'ov-head' }, h('h1', { text: `คำสั่งซื้อ ${code(o.id)}` }), statusBadge(o.status)),
      h('p', { class: 'ov-sub', text: `สร้างเมื่อ ${when(o.createdAt)}` }),
      nextStep(o, ctx),
      o.canShip ? shipForm(o, reload) : null,
      h('div', { class: 'ov-grid' }, h('div', null, ...left), h('div', null, shipCard, money, timeline)),
    ].filter(Boolean));
    if (opts.flash) alertBox(root.querySelector('#ov-alert'), opts.flash, 'success');
    if (location.hash === '#ship' && o.canShip) root.querySelector('#ship').scrollIntoView();
    startTicker(root);
  }

  async function mount(root, orderId, opts = {}) {
    const load = async (flash) => {
      try {
        const o = await api.get(`/orders/${orderId}`);
        render(root, o, { ...opts, flash }, load);
        document.title = `คำสั่งซื้อ ${code(o.id)} | Rakadee`;
      } catch (ex) {
        root.replaceChildren(
          opts.backHref ? h('a', { class: 'ov-back', href: opts.backHref, text: '← กลับไปรายการคำสั่งซื้อ' }) : '',
          h('div', { class: 'alert alert-error', role: 'alert', text: ex.message }));
      }
    };
    await load();
  }

  return { mount, statusBadge, thumb, baht, when, code, h, STATUS };
})();
