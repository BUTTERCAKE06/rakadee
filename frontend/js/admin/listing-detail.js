// pages/admin/listing-detail.js — รายละเอียดสินค้า + approve/reject (api-spec 4.11–4.13)
'use strict';

const STATUS_LABEL = {
  draft: 'ฉบับร่าง',
  pending_review: 'รอตรวจสอบ',
  rejected: 'ไม่อนุมัติ',
  active: 'กำลังประมูล',
  ended: 'สิ้นสุดการประมูล',
  cancelled: 'ยกเลิก',
};
const STATUS_BADGE = {
  pending_review: 'badge-warning',
  active: 'badge-success',
  rejected: 'badge-danger',
};
const CONDITION_LABEL = { new: 'ของใหม่', used_good: 'มือสองสภาพดี', defective: 'มีตำหนิ' };

let currentListingId = null;
let currentListing = null;

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtPrice(n) {
  if (n == null) return '—';
  return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

function showAlert(msg, type = 'error') {
  document.getElementById('alert-area').innerHTML = `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
  window.scrollTo(0, 0);
}

function row(label, value) {
  return `<div class="detail-row"><span class="label">${escHtml(label)}</span><span class="value">${value}</span></div>`;
}

function renderDetail(item) {
  currentListing = item;

  // Page title + badge
  document.getElementById('page-title').textContent = item.title || 'รายละเอียดสินค้า';
  const badgeEl = document.getElementById('status-badge');
  badgeEl.textContent = `● ${STATUS_LABEL[item.status] || item.status}`;
  badgeEl.className = `badge ${STATUS_BADGE[item.status] || ''}`;

  // reject reason banner
  const rejectBanner = item.status === 'rejected' && item.rejectReason
    ? `<div class="reject-banner"><strong>เหตุผลที่ปฏิเสธ:</strong> ${escHtml(item.rejectReason)}</div>`
    : '';

  // Images
  const imagesHtml = (item.images || []).length
    ? `<div class="img-gallery">
        ${(item.images).map(img =>
          `<img src="${escHtml(img.url)}" alt="รูปสินค้า"
            class="${img.isCover ? 'is-cover' : ''}"
            title="${img.isCover ? 'รูปปก' : 'รูปเพิ่มเติม'}" loading="lazy" />`
        ).join('')}
       </div>`
    : `<p class="muted">ไม่มีรูปภาพ</p>`;

  // Category
  const catName = item.category
    ? `${escHtml(item.category.parent?.name || '')} › ${escHtml(item.category.name)}`
    : '—';

  // Seller
  const sellerHtml = item.seller
    ? `${escHtml(item.seller.shopName || item.seller.displayName)} (ID: ${item.seller.id})`
    : '—';

  document.getElementById('main-content').innerHTML = `
    ${rejectBanner}

    <div class="card" style="margin-bottom:20px;">
      <h3 style="margin:0 0 12px;">รูปภาพสินค้า</h3>
      ${imagesHtml}
    </div>

    <div class="detail-grid">
      <div class="card">
        <h3 style="margin:0 0 12px;">ข้อมูลสินค้า</h3>
        ${row('ชื่อสินค้า', escHtml(item.title))}
        ${row('หมวดหมู่', catName)}
        ${row('สภาพสินค้า', escHtml(CONDITION_LABEL[item.itemCondition] || item.itemCondition))}
        ${item.defectDetail ? row('รายละเอียดตำหนิ', escHtml(item.defectDetail)) : ''}
        ${item.includedItems ? row('สิ่งที่ได้รับ', escHtml(item.includedItems)) : ''}
        ${row('ผู้ขาย', sellerHtml)}
      </div>
      <div class="card">
        <h3 style="margin:0 0 12px;">เงื่อนไขประมูล</h3>
        ${row('ราคาเริ่มต้น', fmtPrice(item.startPrice))}
        ${row('ขั้นต่ำการเพิ่มราคา', fmtPrice(item.bidIncrement))}
        ${row('ราคาขั้นต่ำที่ยอมขาย (Reserve)', fmtPrice(item.reservePrice))}
        ${row('ราคาซื้อทันที (Buy Now)', item.buyNowPrice ? fmtPrice(item.buyNowPrice) : '—')}
        ${row('ระยะเวลาประมูล', item.durationDays ? `${item.durationDays} วัน` : '—')}
        ${row('ค่าจัดส่ง', item.shippingFee === 0 ? 'ฟรี' : fmtPrice(item.shippingFee))}
        ${row('จังหวัดต้นทาง', escHtml(item.originProvince))}
        ${row('วันที่ส่งตรวจ', fmtDate(item.submittedAt))}
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 style="margin:0 0 12px;">รายละเอียดสินค้า</h3>
      <p style="white-space:pre-wrap;margin:0;">${escHtml(item.description)}</p>
    </div>
  `;

  // Action bar: แสดงเฉพาะ pending_review
  const actionBar = document.getElementById('action-bar');
  actionBar.style.display = item.status === 'pending_review' ? '' : 'none';
}

/* ───────── Approve ───────── */
async function approveListing() {
  if (!confirm('ยืนยันการอนุมัติสินค้านี้? ระบบจะเริ่มประมูลทันที')) return;
  const btn = document.getElementById('btn-approve');
  btn.disabled = true;
  btn.textContent = 'กำลังอนุมัติ...';
  try {
    const result = await api.post(`/admin/listings/${currentListingId}/approve`);
    showAlert(`อนุมัติสินค้าเรียบร้อยแล้ว! เริ่มประมูลถึง ${fmtDate(result.endAt)}`, 'success');
    document.getElementById('action-bar').style.display = 'none';
    // อัปเดต badge
    const badgeEl = document.getElementById('status-badge');
    badgeEl.textContent = '● กำลังประมูล';
    badgeEl.className = 'badge badge-success';
  } catch (err) {
    showAlert(err.message || 'อนุมัติไม่สำเร็จ');
    btn.disabled = false;
    btn.textContent = '✓ อนุมัติ';
  }
}

/* ───────── Reject Modal ───────── */
function openRejectModal() {
  document.getElementById('reject-reason').value = '';
  document.getElementById('err-reason').textContent = '';
  document.getElementById('reject-modal').classList.add('open');
  document.getElementById('reject-reason').focus();
}
function closeRejectModal() {
  document.getElementById('reject-modal').classList.remove('open');
}

async function confirmReject() {
  const reason = document.getElementById('reject-reason').value.trim();
  document.getElementById('err-reason').textContent = '';
  if (reason.length < 5) {
    document.getElementById('err-reason').textContent = 'กรุณากรอกเหตุผลอย่างน้อย 5 ตัวอักษร';
    return;
  }
  if (reason.length > 500) {
    document.getElementById('err-reason').textContent = 'เหตุผลต้องไม่เกิน 500 ตัวอักษร';
    return;
  }

  const btn = document.getElementById('btn-confirm-reject');
  btn.disabled = true;
  btn.textContent = 'กำลังดำเนินการ...';
  try {
    await api.post(`/admin/listings/${currentListingId}/reject`, { reason });
    closeRejectModal();
    showAlert('ปฏิเสธสินค้าเรียบร้อย ผู้ขายจะได้รับแจ้งเตือน', 'success');
    document.getElementById('action-bar').style.display = 'none';
    const badgeEl = document.getElementById('status-badge');
    badgeEl.textContent = '● ไม่อนุมัติ';
    badgeEl.className = 'badge badge-danger';
    // แสดง reject reason
    const content = document.getElementById('main-content');
    content.insertAdjacentHTML('afterbegin',
      `<div class="reject-banner"><strong>เหตุผลที่ปฏิเสธ:</strong> ${escHtml(reason)}</div>`);
  } catch (err) {
    if (err.code === 'REASON_REQUIRED') {
      document.getElementById('err-reason').textContent = 'กรุณากรอกเหตุผล';
    } else {
      showAlert(err.message || 'ปฏิเสธสินค้าไม่สำเร็จ');
    }
    btn.disabled = false;
    btn.textContent = 'ยืนยันการปฏิเสธ';
  }
}

/* ───────── Init ───────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!user) { location.href = '/pages/login.html'; return; }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      location.href = '/'; return;
    }
  });

  const params = new URLSearchParams(location.search);
  const idParam = params.get('id');
  if (!idParam || !/^\d+$/.test(idParam)) {
    document.getElementById('main-content').innerHTML =
      '<div class="empty-state"><p style="color:var(--color-danger)">ไม่พบสินค้า</p></div>';
    return;
  }
  currentListingId = Number(idParam);

  try {
    const item = await api.get(`/admin/listings/${currentListingId}`);
    renderDetail(item);
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state"><p style="color:var(--color-danger)">${escHtml(err.message || 'ไม่พบสินค้า')}</p></div>`;
  }

  // Buttons
  document.getElementById('btn-approve').addEventListener('click', approveListing);
  document.getElementById('btn-reject').addEventListener('click', openRejectModal);
  document.getElementById('btn-cancel-reject').addEventListener('click', closeRejectModal);
  document.getElementById('btn-confirm-reject').addEventListener('click', confirmReject);

  // Close modal on backdrop click
  document.getElementById('reject-modal').addEventListener('click', function (e) {
    if (e.target === this) closeRejectModal();
  });

  // ESC close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRejectModal();
  });
});
