// pages/seller/open-shop.js — เปิดร้านขาย (api-spec 3.1)
'use strict';

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
  'อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'
];

function showAlert(msg, type = 'error') {
  const area = document.getElementById('alert-area');
  area.innerHTML = `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
}
function clearAlert() { document.getElementById('alert-area').innerHTML = ''; }
function setFieldError(field, msg) {
  document.getElementById('err-' + field).textContent = msg;
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function populateProvinces() {
  const sel = document.getElementById('originProvince');
  PROVINCES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

function validate(data) {
  let ok = true;
  if (!data.shopName.trim()) { setFieldError('shopName', 'กรุณากรอกชื่อร้านค้า'); ok = false; }
  else if (data.shopName.trim().length < 2) { setFieldError('shopName', 'ชื่อร้านต้องมีอย่างน้อย 2 ตัวอักษร'); ok = false; }
  if (!data.originProvince) { setFieldError('originProvince', 'กรุณาเลือกจังหวัดต้นทาง'); ok = false; }
  return ok;
}

async function checkAlreadySeller(user) {
  if (user && user.isSeller) {
    location.href = '/pages/seller/listings.html';
    return true;
  }
  return false;
}

document.addEventListener('user:ready', async (e) => {
  const user = e.detail;
  if (!user) { location.href = '/pages/login.html'; return; }
  if (await checkAlreadySeller(user)) return;
});

document.addEventListener('DOMContentLoaded', () => {
  populateProvinces();

  const form = document.getElementById('form-open-shop');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    clearAlert();

    const data = {
      shopName: document.getElementById('shopName').value,
      shopDescription: document.getElementById('shopDescription').value.trim(),
      originProvince: document.getElementById('originProvince').value,
    };

    if (!validate(data)) return;

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'กำลังดำเนินการ...';

    try {
      await api.post('/seller/profile', data);
      showAlert('เปิดร้านสำเร็จ! กำลังพาไปยังหน้าสินค้าของฉัน...', 'success');
      setTimeout(() => { location.href = '/pages/seller/listings.html'; }, 1200);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'เปิดร้านขาย';
      if (err.code === 'ALREADY_SELLER') {
        location.href = '/pages/seller/listings.html';
      } else if (err.code === 'VALIDATION_ERROR' && err.details) {
        Object.entries(err.details).forEach(([k, v]) => setFieldError(k, v));
      } else {
        showAlert(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    }
  });
});
