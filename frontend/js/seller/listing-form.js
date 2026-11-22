// seller/listing-form.js — ลงสินค้า 4 ขั้น (ภาพ UI 30–33, api-spec 4.2–4.8) เจ้าของ: QA
//
// ข้อจำกัดจาก API ที่ทำให้ flow ต่างจากภาพเล็กน้อย:
//   - 4.2 POST /listings สร้างร่างได้เมื่อข้อมูลครบทุกช่อง (schema บังคับ start_price, duration_days ฯลฯ เป็น NOT NULL)
//     จึง "บันทึกร่าง" ได้เมื่อกรอกครบทั้ง 4 ขั้น ถ้าไม่ครบระบบพาไปขั้นที่ขาด
//   - 4.4 อัปโหลดรูปได้เมื่อมีร่างแล้ว: รูปที่เลือกในขั้น 2 ของสินค้าใหม่จะเก็บในเบราว์เซอร์ก่อน แล้วอัปโหลดทันทีหลังสร้างร่าง
//     (รูปที่เลือกเป็นปกจะอัปโหลดก่อน เพราะ API ตั้งรูปแรกเป็นปกอัตโนมัติ)
//   - ไม่มี API สลับลำดับรูป จึงไม่มี "ลากเพื่อสลับลำดับ" มีแค่ตั้งปก/ลบ (4.5, 4.6)
'use strict';

(() => {
  const PROVINCES = [
    'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
    'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา',
    'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี',
    'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต',
    'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน',
    'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
    'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์',
    'อุทัยธานี', 'อุบลราชธานี',
  ];
  const MAX_IMAGES = 8;
  const MAX_MB = 5;
  const EDITABLE = ['draft', 'pending_review', 'rejected'];
  // ค่าธรรมเนียม (ข้อ 5.4) ใช้แสดงตัวอย่างรายได้เท่านั้น BE คิดจริงตอนปล่อยเงินจาก settings.feeConfig()
  // ค่าจริงอ่านจาก GET /api/fee-config (11.10) ถ้าโหลดไม่ได้ใช้ค่าเริ่มต้น 5% ขั้นต่ำ 20 บาท
  const fee = { percent: 5, min: 20, loaded: false };
  api.get('/fee-config').then((f) => {
    fee.percent = Number(f.percent);
    fee.min = Number(f.min);
    fee.loaded = true;
    if (document.getElementById('income-box')) renderIncome();
  }).catch(() => {});

  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const state = {
    step: 1,
    listingId: null,
    status: null,
    readOnly: false,
    categories: [],
    images: [],   // รูปบน server [{ id, url, isCover }]
    pending: [],  // รูปที่ยังไม่อัปโหลด [{ file, url, isCover }]
  };

  /* ---------- ค่าในฟอร์ม ---------- */
  const val = (id) => $(id).value.trim();
  const num = (id) => (val(id) === '' ? null : Number(val(id)));
  const segValue = (id) => {
    const b = $(id).querySelector('[aria-pressed="true"]');
    return b ? b.dataset.value : '';
  };
  function setSeg(id, value) {
    $(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(value))));
  }

  function collect() {
    const condition = segValue('itemCondition');
    return {
      title: val('title'),
      categoryId: num('categoryId'),
      description: val('description'),
      includedItems: val('includedItems'),
      itemCondition: condition,
      defectDetail: condition === 'new' ? '' : val('defectDetail'),
      shippingFee: num('shippingFee'),
      originProvince: val('originProvince'),
      startPrice: num('startPrice'),
      bidIncrement: num('bidIncrement'),
      reservePrice: num('reservePrice'),
      buyNowPrice: $('buyNowToggle').checked ? num('buyNowPrice') : null,
      durationDays: segValue('durationDays') ? Number(segValue('durationDays')) : null,
    };
  }

  /* ---------- Validation ต่อขั้น (ข้อ 3.3 ตรงกับ BE) ---------- */
  function validateStep(step, d = collect()) {
    const e = {};
    if (step === 1) {
      if (!d.title) e.title = 'กรุณากรอกชื่อสินค้า';
      if (!val('categoryParent')) e.categoryParent = 'กรุณาเลือกหมวดหมู่หลัก';
      if (!d.categoryId) e.categoryId = 'กรุณาเลือกหมวดหมู่ย่อย';
      if (!d.description) e.description = 'กรุณากรอกรายละเอียดสินค้า';
      if (!d.itemCondition) e.itemCondition = 'กรุณาเลือกสภาพสินค้า';
      if ((d.itemCondition === 'used_good' || d.itemCondition === 'defective') && !d.defectDetail) {
        e.defectDetail = 'กรุณาระบุตำหนิ หรือพิมพ์ "ไม่มีตำหนิ"';
      }
    }
    if (step === 2) {
      const count = state.listingId ? state.images.length : state.pending.length;
      if (count < 1) e.images = 'กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป';
    }
    if (step === 3) {
      if (d.shippingFee === null || Number.isNaN(d.shippingFee) || d.shippingFee < 0) e.shippingFee = 'กรุณากรอกค่าจัดส่ง (ใส่ 0 หากส่งฟรี) ห้ามติดลบ';
      if (!d.originProvince) e.originProvince = 'กรุณาเลือกจังหวัดต้นทาง';
    }
    if (step === 4) {
      if (!(d.startPrice > 0)) e.startPrice = 'ราคาเริ่มต้นต้องมากกว่า 0';
      if (!(d.bidIncrement > 0)) e.bidIncrement = 'ขั้นต่ำการเพิ่มราคาต้องมากกว่า 0';
      if (d.reservePrice !== null && (Number.isNaN(d.reservePrice) || d.reservePrice < (d.startPrice || 0))) {
        e.reservePrice = 'ต้องมากกว่าหรือเท่ากับราคาเริ่มต้น';
      }
      if ($('buyNowToggle').checked) {
        if (d.buyNowPrice === null || Number.isNaN(d.buyNowPrice)) e.buyNowPrice = 'กรุณากรอกราคาซื้อทันที หรือปิดการใช้งาน';
        else if (d.buyNowPrice <= (d.startPrice || 0) || (d.reservePrice !== null && d.buyNowPrice <= d.reservePrice)) {
          e.buyNowPrice = 'ต้องมากกว่าราคาเริ่มต้นและมากกว่า Reserve';
        }
      }
      if (![1, 3, 7].includes(d.durationDays)) e.durationDays = 'กรุณาเลือกระยะเวลาประมูล';
    }
    return e;
  }

  function showErrors(errors, step) {
    const root = step ? document.querySelector(`.wizard-step[data-step="${step}"]`) : document;
    root.querySelectorAll('.field-error').forEach((s) => { s.textContent = ''; });
    root.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    Object.entries(errors).forEach(([k, msg]) => {
      const box = $(`err-${k}`);
      if (box) box.textContent = msg;
      const input = $(k);
      if (input && /^(INPUT|SELECT|TEXTAREA)$/.test(input.tagName)) input.setAttribute('aria-invalid', 'true');
    });
  }

  // ขั้นแรกที่ยังไม่ผ่าน (ใช้ตอนบันทึก/ส่งตรวจ) — includeImages: ต้องมีรูปหรือไม่
  function firstInvalidStep(includeImages) {
    const d = collect();
    for (const s of [1, 2, 3, 4]) {
      if (s === 2 && !includeImages) continue;
      const errs = validateStep(s, d);
      if (Object.keys(errs).length) return { step: s, errs };
    }
    return null;
  }

  /* ---------- Wizard ---------- */
  function goStep(n) {
    state.step = n;
    document.querySelectorAll('.wizard-step').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    document.querySelectorAll('#wizard li[data-step]').forEach((li) => {
      const s = Number(li.dataset.step);
      li.className = s < n ? 'done' : s === n ? 'current' : '';
      li.querySelector('button').setAttribute('aria-current', s === n ? 'step' : 'false');
    });
    const last = n === 4;
    $('btn-next').hidden = last || state.readOnly;
    $('btn-preview').hidden = !last || state.readOnly;
    $('btn-submit').hidden = !last || state.readOnly;
    $('btn-draft').hidden = state.readOnly;
    $('btn-back').textContent = n === 1 ? 'ย้อนกลับ' : 'ย้อนกลับ';
    if (n === 4) renderIncome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next() {
    const errs = validateStep(state.step);
    showErrors(errs, state.step);
    if (Object.keys(errs).length) return;
    goStep(state.step + 1);
  }

  /* ---------- หมวดหมู่ / จังหวัด ---------- */
  function fillChildren(parentId, selected) {
    const sel = $('categoryId');
    const parent = state.categories.find((c) => c.id === parentId);
    sel.replaceChildren(el('option', { value: '', text: '— เลือกหมวดหมู่ย่อย —' }),
      ...((parent && parent.children) || []).map((c) => el('option', { value: c.id, text: c.name })));
    sel.disabled = !parent;
    if (selected) sel.value = selected;
  }
  async function loadCategories() {
    try {
      const data = await api.get('/categories');
      state.categories = data.items || data || [];
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
    $('categoryParent').replaceChildren(el('option', { value: '', text: '— เลือกหมวดหมู่หลัก —' }),
      ...state.categories.map((c) => el('option', { value: c.id, text: c.name })));
  }
  function selectCategory(childId) {
    const parent = state.categories.find((c) => (c.children || []).some((ch) => ch.id === childId));
    if (!parent) return;
    $('categoryParent').value = parent.id;
    fillChildren(parent.id, childId);
  }

  /* ---------- รูปภาพ ---------- */
  function imageList() {
    const list = state.listingId ? state.images : state.pending;
    return [...list].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  }

  function renderImages() {
    const grid = $('img-grid');
    const list = imageList();
    const slots = list.map((img, i) => {
      const slot = el('div', { class: `qa-img-slot${i === 0 ? ' is-cover' : ''}` }, el('img', { src: img.url, alt: i === 0 ? 'ภาพปก' : `รูปที่ ${i + 1}` }));
      if (!state.readOnly) {
        const actions = el('div', 'slot-actions');
        if (!img.isCover) actions.append(el('button', { type: 'button', text: 'ตั้งเป็นปก', onclick: () => setCover(img) }));
        actions.append(el('button', { type: 'button', text: 'ลบ', style: 'background:var(--color-danger);color:#fff;', onclick: () => removeImage(img) }));
        slot.append(actions);
      }
      return slot;
    });
    if (!state.readOnly && list.length < MAX_IMAGES) {
      const addCount = list.length === 0 ? 1 : Math.min(3, MAX_IMAGES - list.length);
      for (let i = 0; i < addCount; i += 1) {
        const add = el('button', { type: 'button', class: `qa-img-slot is-add${list.length === 0 ? ' is-cover' : ''}`, 'aria-label': 'เพิ่มรูปสินค้า' },
          '+', el('small', { text: list.length === 0 ? 'เพิ่มรูป (รูปแรกเป็นภาพปก)' : 'เพิ่มรูป' }));
        add.addEventListener('click', () => $('file-input').click());
        slots.push(add);
      }
    }
    grid.replaceChildren(...slots);
    $('img-count').textContent = `อัปโหลดแล้ว ${list.length} / ${MAX_IMAGES} รูป${!state.listingId && list.length ? ' (จะอัปโหลดเมื่อบันทึกร่าง)' : ''}`;
  }

  async function addFiles(files) {
    const current = imageList().length;
    const errors = [];
    const ok = [];
    [...files].forEach((f) => {
      if (!['image/jpeg', 'image/png'].includes(f.type)) errors.push(`${f.name}: รองรับเฉพาะ .jpg .jpeg .png`);
      else if (f.size > MAX_MB * 1024 * 1024) errors.push(`${f.name}: ไฟล์ต้องไม่เกิน ${MAX_MB}MB`);
      else if (current + ok.length >= MAX_IMAGES) errors.push(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป`);
      else ok.push(f);
    });
    $('err-images').textContent = [...new Set(errors)].join(' · ');
    if (!ok.length) return;

    if (state.listingId) {
      const fd = new FormData();
      ok.forEach((f) => fd.append('images', f, f.name));
      try {
        const res = await api.upload(`/listings/${state.listingId}/images`, fd);
        state.images = res.images || [];
      } catch (err) {
        $('err-images').textContent = err.message;
      }
    } else {
      ok.forEach((f) => state.pending.push({ file: f, url: URL.createObjectURL(f), isCover: state.pending.length === 0 }));
    }
    renderImages();
  }

  async function setCover(img) {
    if (state.listingId) {
      try {
        const res = await api.post(`/listings/${state.listingId}/images/${img.id}/cover`);
        state.images = res.images || [];
      } catch (err) { $('err-images').textContent = err.message; }
    } else {
      state.pending.forEach((p) => { p.isCover = p === img; });
    }
    renderImages();
  }

  async function removeImage(img) {
    if (state.listingId) {
      try {
        const res = await api.del(`/listings/${state.listingId}/images/${img.id}`);
        state.images = res.images || [];
      } catch (err) { $('err-images').textContent = err.message; }
    } else {
      state.pending = state.pending.filter((p) => p !== img);
      if (state.pending.length && !state.pending.some((p) => p.isCover)) state.pending[0].isCover = true;
    }
    renderImages();
  }

  /* ---------- ตัวอย่างรายได้ (ขั้น 4) ---------- */
  function renderIncome() {
    const box = $('income-box');
    const price = num('startPrice');
    if (!(price > 0)) {
      box.replaceChildren(el('strong', { text: 'ตัวอย่างรายได้' }), el('span', { class: 'muted', text: 'กรอกราคาเริ่มต้นเพื่อดูค่าธรรมเนียมและยอดสุทธิ' }));
      return;
    }
    const satang = Math.round(price * 100);
    const feeSatang = Math.min(Math.max(Math.round(satang * fee.percent / 100), Math.round(fee.min * 100)), satang);
    const baht = (s) => qa.money(s / 100);
    box.replaceChildren(el('strong', { text: `ตัวอย่างรายได้หากปิดที่ ${baht(satang)}` }),
      el('span', { text: `ค่าธรรมเนียม ${fee.percent}% = ${baht(feeSatang)} (ขั้นต่ำ ฿${fee.min}) · ยอดสุทธิ ${baht(satang - feeSatang)} (ไม่รวมค่าจัดส่ง)` }),
      el('span', { class: 'muted', text: fee.loaded
        ? 'คิดจากค่าธรรมเนียมปัจจุบัน ยอดจริงคิดตามค่าที่ระบบตั้งไว้ตอนปล่อยเงิน'
        : 'คิดจากค่าธรรมเนียมเริ่มต้น ยอดจริงคิดตามค่าที่ระบบตั้งไว้ตอนปล่อยเงิน' }));
  }

  /* ---------- บันทึก ---------- */
  function body() {
    const d = collect();
    return {
      ...d,
      includedItems: d.includedItems || null,
      defectDetail: d.itemCondition === 'new' ? null : (d.defectDetail || null),
    };
  }

  // สร้าง/แก้ร่าง + อัปโหลดรูปที่ค้าง คืนค่า true ถ้าสำเร็จ
  async function persist(includeImages) {
    const bad = firstInvalidStep(includeImages);
    if (bad) {
      goStep(bad.step);
      showErrors(bad.errs, bad.step);
      qa.alertBox($('alert-area'), state.listingId
        ? 'กรุณาแก้ข้อมูลที่ไม่ถูกต้องก่อนบันทึก'
        : 'กรุณากรอกข้อมูลให้ครบทั้ง 4 ขั้นก่อนบันทึกร่าง (ระบบสร้างร่างได้เมื่อข้อมูลครบ)');
      return false;
    }
    try {
      const res = state.listingId
        ? await api.put(`/listings/${state.listingId}`, body())
        : await api.post('/listings', body());
      if (!state.listingId) {
        state.listingId = res.id;
        state.status = res.status;
        history.replaceState({}, '', `?id=${res.id}`);
        $('page-title').textContent = 'แก้ไขสินค้า';
        $('btn-cancel-listing').hidden = false;
      }
      state.images = res.images || state.images;
      if (state.pending.length) {
        const ordered = [...state.pending].sort((a, b) => Number(b.isCover) - Number(a.isCover));
        const fd = new FormData();
        ordered.forEach((p) => fd.append('images', p.file, p.file.name));
        const up = await api.upload(`/listings/${state.listingId}/images`, fd);
        state.images = up.images || [];
        state.pending = [];
      }
      renderImages();
      return true;
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && err.details) {
        showErrors(err.details);
        const step = [1, 3, 4].find((s) => Object.keys(err.details).some((k) => document.querySelector(`.wizard-step[data-step="${s}"] #err-${k}`)));
        if (step) goStep(step);
      }
      qa.alertBox($('alert-area'), err.message);
      return false;
    }
  }

  async function withBusy(btn, fn) {
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  }

  function saveDraft() {
    return withBusy($('btn-draft'), async () => {
      if (await persist(false)) qa.alertBox($('alert-area'), 'บันทึกร่างเรียบร้อยแล้ว', 'success');
    });
  }

  function preview() {
    return withBusy($('btn-preview'), async () => {
      if (await persist(false)) location.href = `/pages/seller/listing-preview.html?id=${state.listingId}`;
    });
  }

  function submit() {
    return withBusy($('btn-submit'), async () => {
      if (!(await persist(true))) return;
      try {
        await api.post(`/listings/${state.listingId}/submit`);
        location.href = '/pages/seller/listings.html?msg=submitted';
      } catch (err) {
        if (err.code === 'IMAGES_REQUIRED') { goStep(2); $('err-images').textContent = err.message; }
        qa.alertBox($('alert-area'), err.message);
      }
    });
  }

  function cancelListing() {
    qa.modal({
      title: 'ยกเลิกสินค้า',
      body: el('p', { text: 'ยกเลิกแล้วจะแก้ไขหรือส่งตรวจสินค้านี้ไม่ได้อีก ต้องการยกเลิกใช่ไหม?' }),
      confirmText: 'ยืนยันยกเลิก',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await api.post(`/listings/${state.listingId}/cancel`);
        location.href = '/pages/seller/listings.html?msg=cancelled';
      },
    });
  }

  /* ---------- โหลดสินค้าเดิม ---------- */
  function populate(item) {
    $('title').value = item.title || '';
    $('description').value = item.description || '';
    $('includedItems').value = item.includedItems || '';
    setSeg('itemCondition', item.itemCondition || '');
    toggleDefect(item.itemCondition);
    $('defectDetail').value = item.defectDetail || '';
    $('shippingFee').value = item.shippingFee ?? '';
    $('originProvince').value = item.originProvince || '';
    $('startPrice').value = item.startPrice ?? '';
    $('bidIncrement').value = item.bidIncrement ?? '';
    $('reservePrice').value = item.reservePrice ?? '';
    const hasBuyNow = item.buyNowPrice !== null && item.buyNowPrice !== undefined;
    $('buyNowToggle').checked = hasBuyNow;
    $('buyNowPrice').disabled = !hasBuyNow;
    $('buyNowPrice').value = hasBuyNow ? item.buyNowPrice : '';
    setSeg('durationDays', item.durationDays || '');
    selectCategory(item.category ? item.category.id : item.categoryId);
    state.images = (item.images || []).map((i) => ({ id: i.id, url: i.url, isCover: i.isCover }));
    state.status = item.status;
    state.readOnly = !EDITABLE.includes(item.status);
    if (state.readOnly) {
      document.querySelectorAll('.card input, .card select, .card textarea, .qa-seg button').forEach((x) => { x.disabled = true; });
      qa.alertBox($('alert-area'), 'สินค้านี้เริ่มประมูลแล้วหรือถูกยกเลิก แก้ไขไม่ได้');
    } else {
      $('btn-cancel-listing').hidden = false;
      if (item.status === 'rejected' && item.rejectReason) {
        qa.alertBox($('alert-area'), `เหตุผลที่ไม่อนุมัติ: ${item.rejectReason} — แก้ไขแล้วกดส่งตรวจสอบอีกครั้ง`);
      }
    }
    renderImages();
  }

  function toggleDefect(condition) {
    $('defect-group').hidden = !condition || condition === 'new';
    $('defect-label').textContent = 'รายละเอียดตำหนิ (บังคับสำหรับสินค้ามือสอง)';
  }

  /* ---------- เริ่มต้น ---------- */
  document.addEventListener('user:ready', async (e) => {
    const user = e.detail;
    if (!user) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (user.role !== 'seller') { location.href = '/pages/seller/open-shop.html'; return; }

    $('originProvince').append(...PROVINCES.map((p) => el('option', { value: p, text: p })));
    await loadCategories();

    // ปุ่มต่างๆ
    $('categoryParent').addEventListener('change', () => fillChildren(Number(val('categoryParent'))));
    ['itemCondition', 'durationDays'].forEach((id) => $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      setSeg(id, b.dataset.value);
      if (id === 'itemCondition') toggleDefect(b.dataset.value);
    })));
    $('buyNowToggle').addEventListener('change', () => {
      $('buyNowPrice').disabled = !$('buyNowToggle').checked;
      if (!$('buyNowToggle').checked) { $('buyNowPrice').value = ''; $('err-buyNowPrice').textContent = ''; }
    });
    $('startPrice').addEventListener('input', renderIncome);
    // ล้าง error ของช่องที่ผู้ใช้เริ่มแก้
    const clearErr = (id) => { const b = $(`err-${id}`); if (b) b.textContent = ''; const i = $(id); if (i) i.removeAttribute('aria-invalid'); };
    document.querySelector('.card').addEventListener('input', (ev) => { if (ev.target.id) clearErr(ev.target.id); });
    document.querySelector('.card').addEventListener('change', (ev) => { if (ev.target.id) clearErr(ev.target.id); });
    ['itemCondition', 'durationDays'].forEach((id) => $(id).addEventListener('click', () => clearErr(id)));
    $('file-input').addEventListener('change', () => { addFiles($('file-input').files); $('file-input').value = ''; });
    $('btn-next').addEventListener('click', next);
    $('btn-back').addEventListener('click', () => {
      if (state.step === 1) location.href = '/pages/seller/listings.html';
      else goStep(state.step - 1);
    });
    $('btn-draft').addEventListener('click', saveDraft);
    $('btn-preview').addEventListener('click', preview);
    $('btn-submit').addEventListener('click', submit);
    $('btn-cancel-listing').addEventListener('click', cancelListing);
    // คลิกหัวขั้น: ย้อนกลับได้เสมอ ไปข้างหน้าได้เมื่อขั้นก่อนหน้าผ่าน
    document.querySelectorAll('#wizard li[data-step] button').forEach((b) => b.addEventListener('click', () => {
      const target = Number(b.closest('li').dataset.step);
      if (target <= state.step || state.readOnly) { goStep(target); return; }
      for (let s = state.step; s < target; s += 1) {
        const errs = validateStep(s);
        if (Object.keys(errs).length) { goStep(s); showErrors(errs, s); return; }
      }
      goStep(target);
    }));

    const id = Number(qa.qs('id'));
    if (id) {
      state.listingId = id;
      $('page-title').textContent = 'แก้ไขสินค้า';
      document.title = 'แก้ไขสินค้า — Rakadee';
      try {
        const item = await api.get(`/listings/${id}`);
        if (item.durationDays == null) item.durationDays = await qa.ownerDurationDays(item.id, item.status).catch(() => null);
        populate(item);
      } catch (err) {
        qa.alertBox($('alert-area'), err.message);
      }
    } else {
      api.get('/seller/profile').then((p) => { if (p && p.originProvince && !val('originProvince')) $('originProvince').value = p.originProvince; }).catch(() => {});
      renderImages();
    }
    const startStep = Number(qa.qs('step'));
    goStep([1, 2, 3, 4].includes(startStep) ? startStep : 1);
  });
})();
