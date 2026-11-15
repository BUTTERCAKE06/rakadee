// pages/seller/listing-form.js — ฟอร์มลงสินค้า (api-spec 4.2–4.8)
'use strict';

/* ───────── Provinces ───────── */
const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น',
  'จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่',
  'ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช',
  'นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี',
  'ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม',
  'มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี',
  'ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล',
  'สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี',
  'สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู',
  'อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];

const CONDITION_LABEL = { new: 'ของใหม่', used_good: 'มือสองสภาพดี', defective: 'มีตำหนิ' };
const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const EDITABLE_STATUSES = new Set(['draft', 'pending_review', 'rejected']);

/* ───────── State ───────── */
let listingId = null;       // null = create mode
let currentImages = [];     // [{ id, url, isCover }]
let categories = [];        // [{ id, name, children:[...] }]
let currentStatus = null;   // สถานะปัจจุบันของสินค้า (edit mode)
let isReadOnly = false;     // true เมื่อ active/ended/cancelled

/* ───────── Utils ───────── */
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtPrice(n) {
  if (n == null || n === '') return '—';
  return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 });
}
function qs(selector) { return document.querySelector(selector); }
function getVal(id) { return document.getElementById(id)?.value.trim() || ''; }
function getNum(id) {
  const v = document.getElementById(id)?.value.trim();
  return v === '' ? null : Number(v);
}

/* ───────── Alert / Error ───────── */
function showAlert(msg, type = 'error') {
  document.getElementById('alert-area').innerHTML =
    `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
  window.scrollTo(0, 0);
}
function clearAlert() { document.getElementById('alert-area').innerHTML = ''; }
function setFieldError(field, msg) {
  const el = document.getElementById('err-' + field);
  if (el) el.textContent = msg;
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
}

/* ───────── Provinces ───────── */
function populateProvinces(defaultVal = '') {
  const sel = document.getElementById('originProvince');
  sel.innerHTML = '<option value="">— เลือกจังหวัด —</option>';
  PROVINCES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === defaultVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ───────── Categories ───────── */
async function loadCategories(selectedCatId = null) {
  try {
    const data = await api.get('/categories');
    categories = data.items || [];
  } catch {
    categories = [];
  }
  const parentSel = document.getElementById('categoryParent');
  const childSel = document.getElementById('categoryId');
  parentSel.innerHTML = '<option value="">— เลือกหมวดหลัก —</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    parentSel.appendChild(opt);
  });

  if (selectedCatId) {
    // หา parent ของ selectedCatId
    const parent = categories.find(c => c.children?.some(ch => ch.id === selectedCatId));
    if (parent) {
      parentSel.value = parent.id;
      populateChildren(parent.id, selectedCatId);
    }
  }

  parentSel.addEventListener('change', () => {
    populateChildren(Number(parentSel.value));
  });
}

function populateChildren(parentId, selectedChildId = null) {
  const childSel = document.getElementById('categoryId');
  const parent = categories.find(c => c.id === parentId);
  childSel.innerHTML = '<option value="">— เลือกหมวดย่อย —</option>';
  if (parent && parent.children) {
    parent.children.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name;
      if (ch.id === selectedChildId) opt.selected = true;
      childSel.appendChild(opt);
    });
    childSel.disabled = false;
  } else {
    childSel.disabled = true;
  }
}

/* ───────── Image Rendering ───────── */
function renderImages() {
  const grid = document.getElementById('img-grid');
  const uploadBox = document.getElementById('upload-box');
  const countEl = document.getElementById('img-count');

  grid.innerHTML = currentImages.map(img => `
    <div class="img-thumb ${img.isCover ? 'is-cover' : ''}" data-id="${img.id}">
      <img src="${escHtml(img.url)}" alt="รูปสินค้า" loading="lazy" />
      ${img.isCover ? '<span class="cover-badge">ปก</span>' : ''}
      ${!isReadOnly ? `
        <div class="img-actions">
          ${!img.isCover ? `<button class="btn-cover" data-id="${img.id}" title="ตั้งเป็นปก">ตั้งปก</button>` : ''}
          <button class="btn-del" data-id="${img.id}" title="ลบรูป">ลบ</button>
        </div>` : ''}
    </div>`).join('');

  // Events
  grid.querySelectorAll('.btn-cover').forEach(btn =>
    btn.addEventListener('click', () => setCover(Number(btn.dataset.id))));
  grid.querySelectorAll('.btn-del').forEach(btn =>
    btn.addEventListener('click', () => deleteImage(Number(btn.dataset.id))));

  const canUpload = !isReadOnly && listingId && currentImages.length < MAX_IMAGES;
  uploadBox.style.display = canUpload ? '' : 'none';
  countEl.textContent = listingId
    ? `${currentImages.length} / ${MAX_IMAGES} รูป${currentImages.length === 0 ? ' — กรุณาอัปโหลดรูปอย่างน้อย 1 รูป' : ''}`
    : '';

  // lock notice
  const lockNotice = document.getElementById('images-lock-notice');
  if (lockNotice) lockNotice.style.display = (!listingId && !isReadOnly) ? '' : 'none';
}

/* ───────── Upload ───────── */
async function handleFileSelect(files) {
  if (!listingId) { showAlert('กรุณาบันทึกร่างก่อนเพื่ออัปโหลดรูป'); return; }

  const remaining = MAX_IMAGES - currentImages.length;
  if (remaining <= 0) { showAlert(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูปแล้ว`); return; }

  const toUpload = Array.from(files).slice(0, remaining);
  const invalid = toUpload.filter(f => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE);
  if (invalid.length > 0) {
    showAlert(`ไฟล์ ${invalid.map(f => f.name).join(', ')} ไม่รองรับ (ต้อง jpg/jpeg/png ไม่เกิน 5 MB)`);
    return;
  }

  const fd = new FormData();
  toUpload.forEach(f => fd.append('images', f));

  try {
    clearAlert();
    const data = await api.upload(`/listings/${listingId}/images`, fd);
    currentImages = data.images || [];
    renderImages();
    updateActionButtons();
  } catch (err) {
    if (err.code === 'TOO_MANY_IMAGES') showAlert(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูปเท่านั้น`);
    else showAlert(err.message || 'อัปโหลดรูปไม่สำเร็จ');
  }
}

async function setCover(imageId) {
  try {
    const data = await api.post(`/listings/${listingId}/images/${imageId}/cover`);
    currentImages = data.images || [];
    renderImages();
  } catch (err) {
    showAlert(err.message || 'ตั้งรูปปกไม่สำเร็จ');
  }
}

async function deleteImage(imageId) {
  if (!confirm('ลบรูปนี้ใช่ไหม?')) return;
  try {
    const data = await api.del(`/listings/${listingId}/images/${imageId}`);
    currentImages = data.images || [];
    renderImages();
    updateActionButtons();
  } catch (err) {
    showAlert(err.message || 'ลบรูปไม่สำเร็จ');
  }
}

/* ───────── Collect form data ───────── */
function collectData() {
  const dur = qs('input[name=durationDays]:checked');
  return {
    title: getVal('title'),
    categoryId: getVal('categoryId') ? Number(getVal('categoryId')) : null,
    description: getVal('description'),
    includedItems: getVal('includedItems'),
    itemCondition: getVal('itemCondition'),
    defectDetail: getVal('defectDetail'),
    shippingFee: getNum('shippingFee'),
    originProvince: getVal('originProvince'),
    startPrice: getNum('startPrice'),
    bidIncrement: getNum('bidIncrement'),
    reservePrice: getNum('reservePrice'),
    buyNowPrice: getNum('buyNowPrice'),
    durationDays: dur ? Number(dur.value) : null,
  };
}

/* ───────── Validation (api-spec 3.3) ───────── */
function validate(data, requireImages = false) {
  clearErrors();
  let ok = true;

  if (!data.title) { setFieldError('title', 'กรุณากรอกชื่อสินค้า'); ok = false; }
  if (!document.getElementById('categoryParent').value) { setFieldError('categoryParent', 'กรุณาเลือกหมวดหลัก'); ok = false; }
  if (!data.categoryId) { setFieldError('categoryId', 'กรุณาเลือกหมวดย่อย'); ok = false; }
  if (!data.description) { setFieldError('description', 'กรุณากรอกรายละเอียดสินค้า'); ok = false; }
  if (!data.itemCondition) { setFieldError('itemCondition', 'กรุณาเลือกสภาพสินค้า'); ok = false; }
  if (data.itemCondition === 'defective' && !data.defectDetail) {
    setFieldError('defectDetail', 'กรุณากรอกรายละเอียดตำหนิ'); ok = false;
  }
  if (data.shippingFee === null || data.shippingFee < 0 || isNaN(data.shippingFee)) {
    setFieldError('shippingFee', 'กรุณากรอกค่าจัดส่ง (0 = ฟรี)'); ok = false;
  }
  if (!data.originProvince) { setFieldError('originProvince', 'กรุณาเลือกจังหวัดต้นทาง'); ok = false; }
  if (!data.startPrice || data.startPrice <= 0) { setFieldError('startPrice', 'ราคาเริ่มต้นต้องมากกว่า 0'); ok = false; }
  if (!data.bidIncrement || data.bidIncrement <= 0) { setFieldError('bidIncrement', 'ขั้นต่ำการเพิ่มราคาต้องมากกว่า 0'); ok = false; }
  if (data.reservePrice !== null && data.reservePrice !== undefined) {
    if (data.reservePrice < data.startPrice) {
      setFieldError('reservePrice', 'ราคาขั้นต่ำที่ยอมขายต้องไม่น้อยกว่าราคาเริ่มต้น'); ok = false;
    }
  }
  if (data.buyNowPrice !== null && data.buyNowPrice !== undefined) {
    if (data.buyNowPrice <= data.startPrice) {
      setFieldError('buyNowPrice', 'ราคาซื้อทันทีต้องมากกว่าราคาเริ่มต้น'); ok = false;
    }
    if (data.reservePrice && data.buyNowPrice <= data.reservePrice) {
      setFieldError('buyNowPrice', 'ราคาซื้อทันทีต้องมากกว่าราคาขั้นต่ำที่ยอมขาย'); ok = false;
    }
  }
  if (!data.durationDays || ![1,3,7].includes(data.durationDays)) {
    setFieldError('durationDays', 'กรุณาเลือกระยะเวลาประมูล'); ok = false;
  }
  if (requireImages) {
    if (currentImages.length === 0) { setFieldError('images', 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป'); ok = false; }
    if (currentImages.length > 0 && !currentImages.some(i => i.isCover)) {
      setFieldError('images', 'กรุณาตั้งรูปปกก่อนส่งตรวจ'); ok = false;
    }
  }
  return ok;
}

/* ───────── Save Draft ───────── */
async function saveDraft() {
  const data = collectData();
  // minimal validation for draft
  clearErrors();
  if (!data.title) { setFieldError('title', 'กรุณากรอกชื่อสินค้า'); return false; }

  // strip nulls for clean body
  const body = {};
  Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') body[k] = v; });
  if (data.shippingFee !== null) body.shippingFee = data.shippingFee;

  setBusy(true, 'btn-draft', 'กำลังบันทึก...');
  try {
    let result;
    if (listingId) {
      result = await api.put(`/listings/${listingId}`, body);
    } else {
      result = await api.post('/listings', body);
    }
    const item = result;
    if (!listingId) {
      listingId = item.id;
      // update URL
      const url = new URL(location.href);
      url.searchParams.set('id', listingId);
      history.replaceState({}, '', url.toString());
      document.getElementById('page-title').textContent = 'แก้ไขสินค้า';
      currentStatus = item.status;
      updateCancelButton();
    }
    renderImages(); // unlock image section
    updateActionButtons();
    showAlert('บันทึกร่างเรียบร้อยแล้ว ✓', 'success');
    return true;
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR' && err.details) {
      Object.entries(err.details).forEach(([k, v]) => setFieldError(k, v));
    } else {
      showAlert(err.message || 'บันทึกร่างไม่สำเร็จ');
    }
    return false;
  } finally {
    setBusy(false, 'btn-draft', '💾 บันทึกร่าง');
  }
}

/* ───────── Submit ───────── */
async function submitListing() {
  const data = collectData();
  if (!validate(data, true)) { window.scrollTo(0, 0); return; }

  // บันทึกข้อมูลล่าสุดก่อนส่งตรวจ
  setBusy(true, 'btn-submit', 'กำลังส่งตรวจ...');
  try {
    const body = {};
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') body[k] = v; });
    if (data.shippingFee !== null) body.shippingFee = data.shippingFee;
    if (listingId) await api.put(`/listings/${listingId}`, body);

    await api.post(`/listings/${listingId}/submit`);
    showAlert('ส่งตรวจเรียบร้อยแล้ว! กำลังพาไปยังสินค้าของฉัน...', 'success');
    setTimeout(() => { location.href = '/pages/seller/listings.html'; }, 1500);
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR' && err.details) {
      Object.entries(err.details).forEach(([k, v]) => setFieldError(k, v));
      window.scrollTo(0, 0);
    } else if (err.code === 'IMAGES_REQUIRED') {
      setFieldError('images', 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
    } else {
      showAlert(err.message || 'ส่งตรวจไม่สำเร็จ');
    }
  } finally {
    setBusy(false, 'btn-submit', '📤 ส่งตรวจ');
  }
}

/* ───────── Cancel Listing ───────── */
async function cancelListing() {
  if (!confirm('ต้องการยกเลิกสินค้านี้ใช่ไหม? ไม่สามารถย้อนกลับได้')) return;
  try {
    await api.post(`/listings/${listingId}/cancel`);
    showAlert('ยกเลิกสินค้าเรียบร้อยแล้ว', 'success');
    setTimeout(() => { location.href = '/pages/seller/listings.html'; }, 1200);
  } catch (err) {
    showAlert(err.message || 'ยกเลิกสินค้าไม่สำเร็จ');
  }
}

/* ───────── Preview ───────── */
function showPreview() {
  const data = collectData();
  const cover = currentImages.find(i => i.isCover) || currentImages[0];
  const catEl = document.getElementById('categoryId');
  const catName = catEl.options[catEl.selectedIndex]?.text || '—';
  const parentCatEl = document.getElementById('categoryParent');
  const parentName = parentCatEl.options[parentCatEl.selectedIndex]?.text || '—';

  const imagesHtml = currentImages.length
    ? `<div class="preview-images">${currentImages.map(i =>
        `<img src="${escHtml(i.url)}" alt="รูปสินค้า" style="border:${i.isCover ? '2px solid var(--color-accent)' : 'none'}">`
      ).join('')}</div>`
    : `<p class="muted">ยังไม่มีรูปภาพ</p>`;

  const rows = [
    ['ชื่อสินค้า', data.title || '—'],
    ['หมวดหมู่', `${parentName} › ${catName}`],
    ['สภาพสินค้า', CONDITION_LABEL[data.itemCondition] || '—'],
    ...(data.defectDetail ? [['รายละเอียดตำหนิ', data.defectDetail]] : []),
    ['ค่าจัดส่ง', data.shippingFee === 0 ? 'ฟรี' : fmtPrice(data.shippingFee)],
    ['จังหวัดต้นทาง', data.originProvince || '—'],
    ['ราคาเริ่มต้น', fmtPrice(data.startPrice)],
    ['ขั้นต่ำการเพิ่มราคา', fmtPrice(data.bidIncrement)],
    ...(data.reservePrice ? [['ราคาขั้นต่ำที่ยอมขาย (ซ่อน)', fmtPrice(data.reservePrice)]] : []),
    ...(data.buyNowPrice ? [['ราคาซื้อทันที', fmtPrice(data.buyNowPrice)]] : []),
    ['ระยะเวลาประมูล', data.durationDays ? `${data.durationDays} วัน` : '—'],
  ];

  document.getElementById('preview-content').innerHTML = `
    ${imagesHtml}
    <p style="margin:0 0 4px;font-size:13px;color:var(--color-muted);">รายละเอียด</p>
    ${rows.map(([k,v]) =>
      `<div class="preview-row"><span>${escHtml(k)}</span><span>${escHtml(String(v))}</span></div>`
    ).join('')}
    ${data.description ? `<div style="margin-top:16px;"><p class="muted" style="margin:0 0 4px;font-size:13px;">รายละเอียดสินค้า</p><p style="white-space:pre-wrap;">${escHtml(data.description)}</p></div>` : ''}
  `;
  document.getElementById('preview-modal').classList.add('open');
}

function closePreview() {
  document.getElementById('preview-modal').classList.remove('open');
}

/* ───────── Button helpers ───────── */
function setBusy(busy, btnId, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = label;
}

function updateActionButtons() {
  const hasId = !!listingId;
  document.getElementById('btn-preview').disabled = !hasId;
  document.getElementById('btn-submit').disabled = !hasId || currentImages.length === 0;
}

function updateCancelButton() {
  const btn = document.getElementById('btn-cancel-listing');
  if (!btn) return;
  const show = listingId && EDITABLE_STATUSES.has(currentStatus);
  btn.style.display = show ? '' : 'none';
}

/* ───────── Populate form from existing listing ───────── */
function populateForm(item) {
  document.getElementById('title').value = item.title || '';
  document.getElementById('description').value = item.description || '';
  document.getElementById('includedItems').value = item.includedItems || '';
  document.getElementById('itemCondition').value = item.itemCondition || '';
  document.getElementById('defectDetail').value = item.defectDetail || '';
  document.getElementById('shippingFee').value = item.shippingFee ?? '';
  document.getElementById('startPrice').value = item.startPrice ?? '';
  document.getElementById('bidIncrement').value = item.bidIncrement ?? '';
  document.getElementById('reservePrice').value = item.reservePrice ?? '';
  document.getElementById('buyNowPrice').value = item.buyNowPrice ?? '';

  if (item.durationDays) {
    const radio = document.querySelector(`input[name=durationDays][value="${item.durationDays}"]`);
    if (radio) radio.checked = true;
  }

  // defect detail visibility
  toggleDefectDetail(item.itemCondition);

  // province
  populateProvinces(item.originProvince || '');

  // category
  const catId = item.category?.id ?? item.categoryId;
  loadCategories(catId);

  // images
  currentImages = (item.images || []).map(i => ({
    id: i.id,
    url: i.url,
    isCover: i.isCover,
  }));
  renderImages();

  currentStatus = item.status;
  isReadOnly = !EDITABLE_STATUSES.has(item.status);

  if (isReadOnly) {
    // ล็อกทุก input
    document.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
    document.getElementById('btn-draft').disabled = true;
    document.getElementById('btn-submit').disabled = true;
    showAlert(`สินค้าอยู่ในสถานะ "${item.status}" ไม่สามารถแก้ไขได้`, 'error');
  }

  updateActionButtons();
  updateCancelButton();
}

function toggleDefectDetail(condition) {
  const grp = document.getElementById('defect-group');
  if (grp) grp.style.display = condition === 'defective' ? '' : 'none';
}

/* ───────── Disable form in read-only ───────── */
function setFormReadOnly(flag) {
  document.querySelectorAll('#sec-info input, #sec-info select, #sec-info textarea,#sec-shipping input, #sec-shipping select, #sec-auction input').forEach(el => {
    el.disabled = flag;
  });
}

/* ───────── Init ───────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Guard
  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!user) { location.href = '/pages/login.html'; return; }
    if (!user.isSeller) { location.href = '/pages/seller/open-shop.html'; return; }

    // set default province from shop
    if (!listingId) {
      api.get('/seller/profile').then(profile => {
        const sel = document.getElementById('originProvince');
        if (sel && profile.originProvince) sel.value = profile.originProvince;
      }).catch(() => {});
    }
  });

  const params = new URLSearchParams(location.search);
  const idParam = params.get('id');

  populateProvinces();
  await loadCategories();

  if (idParam && /^\d+$/.test(idParam)) {
    // Edit mode
    listingId = Number(idParam);
    document.getElementById('page-title').textContent = 'แก้ไขสินค้า';
    try {
      const item = await api.get(`/listings/${listingId}`);
      populateForm(item);
    } catch (err) {
      showAlert(err.code === 'NOT_FOUND' ? 'ไม่พบสินค้านี้' : (err.message || 'โหลดข้อมูลไม่สำเร็จ'));
    }
  } else {
    // Create mode
    renderImages();
    document.getElementById('btn-preview').disabled = true;
    document.getElementById('btn-submit').disabled = true;
  }

  // itemCondition toggle
  document.getElementById('itemCondition').addEventListener('change', function () {
    toggleDefectDetail(this.value);
  });

  // File input
  document.getElementById('file-input').addEventListener('change', function () {
    if (this.files.length) handleFileSelect(this.files);
    this.value = '';
  });

  // Buttons
  document.getElementById('btn-draft').addEventListener('click', saveDraft);
  document.getElementById('btn-preview').addEventListener('click', showPreview);
  document.getElementById('btn-submit').addEventListener('click', submitListing);
  document.getElementById('btn-cancel-listing').addEventListener('click', cancelListing);
  document.getElementById('btn-close-preview').addEventListener('click', closePreview);
  document.getElementById('btn-close-preview2').addEventListener('click', closePreview);
  document.getElementById('btn-submit-from-preview').addEventListener('click', () => {
    closePreview();
    submitListing();
  });

  // Close modal on backdrop click
  document.getElementById('preview-modal').addEventListener('click', function (e) {
    if (e.target === this) closePreview();
  });
});
