// pages/admin/listings.js — ตรวจสอบสินค้า (api-spec 4.10)
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
  draft: '',
  ended: '',
  cancelled: '',
};

let currentStatus = 'pending_review';
let currentPage = 1;
// เวลาเหลือไม่เกินนี้ ป้ายนับถอยหลังเป็นสีแดง (เหมือนหน้าผู้ขาย)
const ENDING_SOON_MS = 60 * 60 * 1000;
// ส่วนต่างเวลา server กับเครื่อง (ใช้เวลา server ตามกติกา) null = ซิงก์ไม่ได้ → ไม่แสดงนับถอยหลัง
let serverOffsetMs = null;
const CLOCK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

let searchQ = new URLSearchParams(location.search).get('q') || ''; // รับคำค้นจากช่องค้นหาแถบบน
const LIMIT = 20;

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtPrice(n) {
  return '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

async function syncServerTime() {
  try {
    const h = await api.get('/health'); // { serverTime }
    serverOffsetMs = Date.parse(h.serverTime) - Date.now();
  } catch {
    serverOffsetMs = null;
  }
}

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
  const now = Date.now() + serverOffsetMs;
  document.querySelectorAll('.countdown[data-end]').forEach((el) => {
    const left = Date.parse(el.dataset.end) - now;
    el.querySelector('.cd-text').textContent = fmtRemaining(left);
    el.classList.toggle('is-urgent', left <= ENDING_SOON_MS);
  });
}

function showAlert(msg, type = 'error') {
  document.getElementById('alert-area').innerHTML = `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
}

async function loadListings() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="empty-state"><p>กำลังโหลด...</p></div>';
  document.getElementById('pagination').innerHTML = '';

  const qs = new URLSearchParams({ status: currentStatus, page: currentPage, limit: LIMIT });
  if (searchQ) qs.set('q', searchQ);

  try {
    const data = await api.get(`/admin/listings?${qs.toString()}`);
    const items = data.items || [];

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>ไม่มีรายการในสถานะนี้</p></div>';
      return;
    }

    const rows = items.map(item => {
      const coverHtml = item.coverUrl
        ? `<img class="cover-sm" src="${escHtml(item.coverUrl)}" alt="" loading="lazy" />`
        : `<div class="cover-sm-placeholder">🖼</div>`;
      const badge = STATUS_BADGE[item.status] || '';
      const countdownHtml = item.status === 'active' && item.endAt && serverOffsetMs !== null
        ? `<span class="countdown" data-end="${escHtml(item.endAt)}">${CLOCK_ICON}<span class="cd-text"></span></span>`
        : '';
      return `
        <tr class="row-link" data-id="${item.id}" title="คลิกดูรายละเอียด">
          <td>${coverHtml}</td>
          <td>
            <strong>${escHtml(item.title)}</strong><br>
            <span class="badge ${badge}" style="font-size:12px;">● ${escHtml(STATUS_LABEL[item.status] || item.status)}</span>${countdownHtml}
          </td>
          <td>${escHtml(item.seller?.displayName || item.seller?.shopName || '—')}</td>
          <td>${escHtml(item.categoryName || '—')}</td>
          <td>${fmtPrice(item.startPrice)}</td>
          <td style="font-size:13px;color:var(--color-muted);">${fmtDate(item.submittedAt)}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="data-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>ชื่อสินค้า</th>
              <th>ผู้ขาย</th>
              <th>หมวดหมู่</th>
              <th>ราคาเริ่มต้น</th>
              <th>วันที่ส่ง</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    container.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        location.href = `/pages/admin/listing-detail.html?id=${tr.dataset.id}`;
      });
    });

    tickCountdowns(); // แสดงค่าทันที ไม่ต้องรอ 1 วินาที

    // Pagination
    const total = data.total || 0;
    const totalPages = Math.ceil(total / LIMIT);
    renderPagination(currentPage, totalPages);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--color-danger)">${escHtml(err.message)}</p></div>`;
  }
}

function renderPagination(page, total) {
  const pg = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button class="btn" data-p="${page-1}">‹ ก่อนหน้า</button>`;
  html += `<span class="muted">หน้า ${page} / ${total}</span>`;
  if (page < total) html += `<button class="btn" data-p="${page+1}">ถัดไป ›</button>`;
  pg.innerHTML = html;
  pg.querySelectorAll('button[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.p);
      loadListings();
      window.scrollTo(0, 0);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!user) { location.href = '/pages/login.html'; return; }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      location.href = '/'; return;
    }
  });

  // Tabs
  document.getElementById('tab-bar').querySelectorAll('button[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('tab-bar').querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      currentPage = 1;
      loadListings();
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.value = searchQ;
  document.getElementById('btn-search').addEventListener('click', () => {
    searchQ = searchInput.value.trim();
    currentPage = 1;
    loadListings();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { searchQ = searchInput.value.trim(); currentPage = 1; loadListings(); }
  });

  // ซิงก์เวลา server ก่อนโหลดรายการ แล้วเดินเวลาทุก 1 วินาที
  syncServerTime().finally(() => {
    loadListings();
    setInterval(tickCountdowns, 1000);
  });
});
