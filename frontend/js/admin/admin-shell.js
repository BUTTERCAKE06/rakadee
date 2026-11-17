// admin-shell.js — โครงหน้า Admin (sidebar + แถบบน) แยกจาก layout.js ไม่ต้องโหลด layout.js ในหน้า admin
// โหลดต่อจาก /js/api.js และก่อนสคริปต์ของหน้า; ทำหน้าที่แทน layout.js ในส่วน:
//   window.currentUser + event 'user:ready' (หน้า admin ใช้ guard ตัวเดิมได้)
'use strict';

const ADMIN_NAV = [
  { href: '/pages/admin/dashboard.html', label: 'ภาพรวมระบบ', match: ['/pages/admin/dashboard.html'] },
  { href: '/pages/admin/listings.html', label: 'ตรวจสอบและอนุมัติสินค้า',
    match: ['/pages/admin/listings.html', '/pages/admin/listing-detail.html'] },
  { href: '/pages/admin/payments.html', label: 'ตรวจสอบการชำระเงิน', match: ['/pages/admin/payments.html'] },
  { href: '/pages/admin/disputes.html', label: 'จัดการข้อพิพาทและคำร้อง', match: ['/pages/admin/disputes.html'] },
  { href: '/pages/admin/audit-logs.html', label: 'บันทึกการทำงาน (Audit Log)', match: ['/pages/admin/audit-logs.html'] },
];

const ICON_SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICON_HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function roleLabel(user) {
  return user && user.role === 'super_admin' ? 'Super Admin' : 'Admin';
}

function renderSidebar(user) {
  const side = document.getElementById('admin-sidebar');
  if (!side) return;

  const brand = mk('div', 'admin-brand');
  brand.appendChild(mk('div', 'logo', 'R'));
  const txt = mk('div');
  txt.appendChild(mk('div', 'name', 'RAKADEE'));
  txt.appendChild(mk('div', 'role', `Role : ${roleLabel(user)}`));
  brand.appendChild(txt);

  const nav = mk('nav', 'admin-nav');
  ADMIN_NAV.forEach((item) => {
    const a = mk('a', item.match.includes(location.pathname) ? 'active' : '', item.label);
    a.href = item.href;
    nav.appendChild(a);
  });

  const foot = mk('div', 'admin-sidebar-foot');
  const logout = mk('button', 'admin-logout', 'ออกจากระบบ');
  logout.type = 'button';
  logout.addEventListener('click', () => { api.setToken(null); location.href = '/pages/login.html'; });
  foot.appendChild(logout);

  side.replaceChildren(brand, nav, foot);
}

function renderTopbar(user) {
  const bar = document.getElementById('admin-topbar');
  if (!bar) return;

  // ช่องค้นหา → ไปหน้ารายการสินค้า พร้อมคำค้น (api-spec 4.10 พารามิเตอร์ q)
  const form = mk('form', 'admin-search');
  form.setAttribute('role', 'search');
  form.insertAdjacentHTML('beforeend', ICON_SEARCH);
  const input = mk('input');
  input.type = 'search';
  input.id = 'admin-search-input';
  input.placeholder = 'ค้นหาสินค้า / ผู้ขาย...';
  input.setAttribute('aria-label', 'ค้นหา');
  input.value = new URLSearchParams(location.search).get('q') || '';
  form.appendChild(input);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    location.href = '/pages/admin/listings.html' + (q ? `?q=${encodeURIComponent(q)}` : '');
  });

  // หัวใจ = แจ้งเตือน → หน้าการแจ้งเตือน จุดแดงแสดงเมื่อมีที่ยังไม่อ่าน (PM: api-spec 11.2)
  const bell = mk('a', 'admin-icon-btn');
  bell.href = '/pages/notifications.html';
  bell.title = 'แจ้งเตือน';
  bell.setAttribute('aria-label', 'แจ้งเตือน');
  bell.insertAdjacentHTML('beforeend', ICON_HEART);
  const dot = mk('span', 'dot');
  dot.id = 'admin-unread-dot';
  dot.hidden = true;
  bell.appendChild(dot);

  // แท็บโปรไฟล์ → หน้าตั้งค่า (งานของ PM)
  const profile = mk('a', 'admin-profile');
  profile.href = '/pages/settings.html';
  const name = (user && (user.displayName || user.username)) || 'Admin';
  profile.appendChild(mk('div', 'avatar', name.trim().slice(0, 2).toUpperCase()));
  const who = mk('div', 'who');
  who.appendChild(mk('strong', '', name));
  who.appendChild(mk('small', '', user && user.role === 'super_admin' ? 'Super Admin' : 'Administrator'));
  profile.appendChild(who);

  // แถบเดียวกัน: ชื่อหน้า (data-title) อยู่ซ้าย / ค้นหา + หัวใจ + โปรไฟล์ อยู่ขวา
  const actions = mk('div', 'admin-topbar-actions');
  actions.append(form, bell, profile);
  const title = bar.dataset.title;
  if (title) bar.replaceChildren(mk('h1', 'admin-topbar-title', title), actions);
  else bar.replaceChildren(actions);
}

window.adminShell = {
  setUnread(n) {
    const dot = document.getElementById('admin-unread-dot');
    if (dot) dot.hidden = !(Number(n) > 0);
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  let user = null;
  if (api.getToken()) {
    try { user = await api.get('/auth/me'); } catch { user = null; }
  }
  renderSidebar(user);
  renderTopbar(user);
  if (user) api.get('/notifications/unread-count').then((d) => window.adminShell.setUnread(d.unreadCount)).catch(() => {});
  window.currentUser = user;
  document.dispatchEvent(new CustomEvent('user:ready', { detail: user }));
});
