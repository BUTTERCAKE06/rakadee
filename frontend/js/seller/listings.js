// pages/seller/listings.js — สินค้าของฉัน (api-spec 4.9)
'use strict';

const STATUS_LABEL = {
  draft: 'ฉบับร่าง',
  pending_review: 'รอตรวจสอบ',
  rejected: 'ไม่อนุมัติ',
  active: 'กำลังประมูล',
  ended: 'สิ้นสุดการประมูล',
  cancelled: 'ยกเลิก',
};
const STATUS_BADGE_CLASS = {
  draft: '',
  pending_review: 'badge-warning',
  rejected: 'badge-danger',
  active: 'badge-success',
  ended: '',
  cancelled: '',
};
const EDITABLE_STATUSES = new Set(['draft', 'pending_review', 'rejected']);
const CANCELLABLE_STATUSES = new Set(['draft', 'pending_review', 'rejected']);

// เวลาเหลือน้อยกว่านี้ ป้ายนับถอยหลังเป็นสีแดง (ค่ากำหนดเอง ยังไม่มีใน config/time.js)
const ENDING_SOON_MS = 60 * 60 * 1000;

// ส่วนต่างระหว่างเวลา server กับเครื่อง (ใช้เวลา server ตามกติกา ไม่ใช้นาฬิกาเครื่องล้วนๆ)
// null = ยังซิงก์ไม่ได้ จะไม่แสดงนับถอยหลัง
let serverOffsetMs = null;
let countdownTimer = null;

let currentStatus = 'draft';
let currentPage = 1;
const LIMIT = 12;

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function showAlert(msg, type = 'error') {
  document.getElementById('alert-area').innerHTML =
    `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
}

function fmtPrice(n) {
  return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function syncServerTime() {
  try {
    const h = await api.get('/health'); // { serverTime }
    serverOffsetMs = Date.parse(h.serverTime) - Date.now();
  } catch {
    serverOffsetMs = null;
  }
}

function nowServer() { return Date.now() + serverOffsetMs; }

// 2 ชม. 15 น. | 1 วัน 3 ชม. | 12 น. 05 วิ.
function fmtRemaining(ms) {
  if (ms <= 0) return 'หมดเวลา';
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} น.`;
  return `${m} น. ${String(s).padStart(2, '0')} วิ.`;
}

function tickCountdowns() {
  if (serverOffsetMs === null) return;
  document.querySelectorAll('.countdown[data-end]').forEach((el) => {
    const left = Date.parse(el.dataset.end) - nowServer();
    el.querySelector('.cd-text').textContent = fmtRemaining(left);
    el.classList.toggle('badge-danger', left <= ENDING_SOON_MS);
  });
}

const CLOCK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

function renderCard(item) {
  const editable = EDITABLE_STATUSES.has(item.status);
  const cancellable = CANCELLABLE_STATUSES.has(item.status);
  const badgeClass = STATUS_BADGE_CLASS[item.status] || '';

  const coverHtml = item.coverUrl
    ? `<img src="${escHtml(item.coverUrl)}" alt="${escHtml(item.title)}" loading="lazy" />`
    : `<div class="img-placeholder">🖼</div>`;

  const rejectHtml = item.status === 'rejected' && item.rejectReason
    ? `<div class="reject-reason">❌ เหตุผล: ${escHtml(item.rejectReason)}</div>`
    : '';

  const editBtn = editable
    ? `<a href="/pages/seller/listing-form.html?id=${item.id}" class="btn" style="font-size:13px;padding:6px 10px;">แก้ไข</a>`
    : '';
  const cancelBtn = cancellable
    ? `<button class="btn btn-danger btn-cancel" data-id="${item.id}" style="font-size:13px;padding:6px 10px;">ยกเลิก</button>`
    : '';

  const hasBid = item.currentPrice !== null && item.currentPrice !== undefined;
  const showBids = item.status === 'active' || item.status === 'ended';
  const showCountdown = item.status === 'active' && item.endAt && serverOffsetMs !== null;
  const priceLabel = hasBid ? 'ราคาปัจจุบัน' : 'ราคาเริ่มต้น';
  const price = hasBid ? item.currentPrice : item.startPrice;

  // ขวาล่าง: ป้ายสถานะ (อยู่บน) + เวลานับถอยหลัง (ถ้ามี) ถ้าไม่มีเวลา ป้ายสถานะอยู่ขวาล่างตามเดิม
  const countdownHtml = showCountdown
    ? `<span class="badge countdown" data-end="${escHtml(item.endAt)}">${CLOCK_ICON}<span class="cd-text"></span></span>`
    : '';

  return `
    <div class="listing-card">
      ${coverHtml}
      <div class="body">
        <p class="title" title="${escHtml(item.title)}">${escHtml(item.title)}</p>
        <div class="price-row">
          <div class="price-block">
            <p class="meta">${priceLabel}</p>
            <p class="price">${fmtPrice(price)}</p>
            ${showBids ? `<span class="bids">${Number(item.bidCount) || 0} การบิด</span>` : ''}
          </div>
          <div class="status-col">
            <span class="badge ${badgeClass}">● ${escHtml(STATUS_LABEL[item.status] || item.status)}</span>
            ${countdownHtml}
          </div>
        </div>
        ${rejectHtml}
        <div class="actions">
          ${editBtn}
          ${cancelBtn}
        </div>
      </div>
    </div>`;
}

async function loadListings(status, page = 1) {
  const container = document.getElementById('listing-container');
  container.innerHTML = '<div class="empty-state"><p>กำลังโหลด...</p></div>';
  document.getElementById('pagination').innerHTML = '';

  try {
    const [data] = await Promise.all([
      api.get(`/seller/listings?status=${status}&page=${page}&limit=${LIMIT}`),
      syncServerTime(),
    ]);
    const items = data.items || [];

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📦</div>
          <p>ไม่มีสินค้าในสถานะนี้</p>
          ${status === 'draft' ? '<a href="/pages/seller/listing-form.html" class="btn btn-primary" style="margin-top:8px;">+ ลงสินค้าใหม่</a>' : ''}
        </div>`;
      return;
    }

    container.innerHTML = `<div class="listing-grid">${items.map(renderCard).join('')}</div>`;
    tickCountdowns();

    // Pagination
    const total = data.total || 0;
    const totalPages = Math.ceil(total / LIMIT);
    if (totalPages > 1) renderPagination(page, totalPages, status);

    // Cancel buttons
    container.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => confirmCancel(Number(btn.dataset.id)));
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--color-danger)">${escHtml(err.message)}</p></div>`;
  }
}

function renderPagination(page, total, status) {
  const pg = document.getElementById('pagination');
  let html = '';
  if (page > 1) html += `<button class="btn" data-p="${page-1}">‹ ก่อนหน้า</button>`;
  html += `<span class="muted" style="padding:8px;">หน้า ${page} / ${total}</span>`;
  if (page < total) html += `<button class="btn" data-p="${page+1}">ถัดไป ›</button>`;
  pg.innerHTML = html;
  pg.querySelectorAll('button[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.p);
      loadListings(status, currentPage);
      window.scrollTo(0, 0);
    });
  });
}

async function confirmCancel(id) {
  if (!confirm('ต้องการยกเลิกสินค้านี้ใช่ไหม? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;
  try {
    await api.post(`/listings/${id}/cancel`);
    showAlert('ยกเลิกสินค้าเรียบร้อยแล้ว', 'success');
    loadListings(currentStatus, currentPage);
  } catch (err) {
    showAlert(err.message || 'ไม่สามารถยกเลิกสินค้าได้');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Guard: ต้อง login และเป็น seller
  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!user) { location.href = '/pages/login.html'; return; }
    if (!user.isSeller) { location.href = '/pages/seller/open-shop.html'; return; }
  });

  // Tabs
  const tabBar = document.getElementById('tab-bar');
  tabBar.querySelectorAll('button[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      currentPage = 1;
      loadListings(currentStatus, 1);
    });
  });

  loadListings(currentStatus, 1);
  countdownTimer = setInterval(tickCountdowns, 1000);
});