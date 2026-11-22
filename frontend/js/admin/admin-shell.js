// admin-shell.js — โครงหน้า Admin (sidebar + แถบบน) ตามภาพ UI (A2 / A5 / A6) แยกจาก layout.js
// เจ้าของ: QA (ใช้ร่วมทุกหน้าแอดมิน) · โหลดต่อจาก /js/api.js และก่อนสคริปต์ของหน้า
// ให้หน้าอื่นใช้: window.currentUser + event 'user:ready' + window.adminShell.setUnread(n)
// หน้าที่มี <div id="admin-topbar" data-title="..."> จะได้หัวข้อ h1 ที่ต้นเนื้อหา (ตามภาพ หัวข้ออยู่ในเนื้อหา ไม่ได้อยู่ในแถบบน)
// เมนูที่ยังไม่มีหน้า (ready: false) แสดงเป็นตัวจางกดไม่ได้ พร้อม tooltip บอกเจ้าของ
'use strict';

const ADMIN_NAV = [
  { href: '/pages/admin/dashboard.html', label: 'ภาพรวม', ready: true },
  { href: '/pages/admin/listings.html', label: 'สินค้า', ready: true, match: ['/pages/admin/listing-detail.html'] },
  // เพิ่มจากภาพ: คำแนะนำอาจารย์ข้อ 2 (D-18)
  { href: '/pages/admin/seller-applications.html', label: 'ตรวจร้านค้า', ready: true, match: ['/pages/admin/seller-application.html', '/pages/admin/sellers.html'] },
  { href: '/pages/admin/auctions.html', label: 'การประมูล', ready: false, note: 'ยังไม่มีหน้าและ API สำหรับแอดมิน' },
  { href: '/pages/admin/orders.html', label: 'คำสั่งซื้อ', ready: true },   // PM (API 8.7)
  { href: '/pages/admin/payments.html', label: 'การเงิน', ready: true },    // SA ตรวจสอบการชำระเงิน (API 7.8–7.11)
  { href: '/pages/admin/disputes.html', label: 'ข้อพิพาท', ready: true, match: ['/pages/admin/dispute-detail.html'] },
  // บิดน่าสงสัย (ข้อ 7.3, API 10.6) อยู่เป็นแท็บในหน้าผู้ใช้
  { href: '/pages/admin/users.html', label: 'ผู้ใช้', ready: true, match: ['/pages/admin/suspicious-flags.html'] },
  { href: '/pages/admin/roles.html', label: 'สิทธิ์', ready: false, note: 'ยังไม่มีหน้าและ API จัดการสิทธิ์แอดมิน' },
  { href: '/pages/admin/audit-logs.html', label: 'Audit Log', ready: true },
  { href: '/pages/admin/settings.html', label: 'ตั้งค่าระบบ', ready: true, superOnly: true },   // PM (API 11.8–11.9) เมนูขึ้นเฉพาะ Super Admin
];

const ICON_BELL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderSidebar(user) {
  const side = document.getElementById('admin-sidebar');
  if (!side) return;

  const brand = mk('a', 'admin-brand');
  brand.href = '/pages/admin/dashboard.html';
  brand.appendChild(mk('span', 'logo', 'R'));
  brand.appendChild(mk('span', 'name', 'Admin'));

  const nav = mk('nav', 'admin-nav');
  nav.setAttribute('aria-label', 'เมนูแอดมิน');
  ADMIN_NAV.forEach((item) => {
    if (item.superOnly && (!user || user.role !== 'super_admin')) return;
    const active = location.pathname === item.href || (item.match || []).includes(location.pathname);
    let node;
    if (item.ready) {
      node = mk('a', active ? 'active' : '', item.label);
      node.href = item.href;
      if (active) node.setAttribute('aria-current', 'page');
    } else {
      node = mk('span', 'is-disabled', item.label);
      node.title = item.note;
      node.setAttribute('aria-disabled', 'true');
    }
    nav.appendChild(node);
  });

  // ออกจากระบบย้ายไปอยู่ในเมนูอีเมลมุมขวาบน
  side.replaceChildren(brand, nav);
}

function logout() {
  api.post('/auth/logout').catch(() => {}).finally(() => { api.setToken(null); location.href = '/pages/login.html'; });
}

// เมนูบัญชีใต้อีเมลมุมขวาบน: การแจ้งเตือน / ตั้งค่า / ออกจากระบบ
function renderAccountMenu(user) {
  const wrap = mk('div', 'admin-account');
  const btn = mk('button', 'admin-email', (user && user.email) || '');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.appendChild(mk('span', 'admin-caret', '▾'));

  const menu = mk('div', 'admin-account-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const item = (label, href) => { const a = mk('a', '', label); a.href = href; a.setAttribute('role', 'menuitem'); return a; };
  const out = mk('button', 'is-danger', 'ออกจากระบบ');
  out.type = 'button';
  out.setAttribute('role', 'menuitem');
  out.addEventListener('click', logout);
  menu.append(item('การแจ้งเตือน', '/pages/notifications.html'), item('ตั้งค่า', '/pages/settings.html'), out);

  const setOpen = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  wrap.append(btn, menu);
  return wrap;
}

function renderTopbar(user) {
  const bar = document.getElementById('admin-topbar');
  if (!bar) return;

  // กระดิ่ง + คำว่า "แจ้งเตือน" (คำแนะนำอาจารย์ข้อ 2 — ภาพ UI ไม่มีปุ่มนี้)
  const bell = mk('a', 'admin-bell');
  bell.href = '/pages/notifications.html';
  bell.insertAdjacentHTML('beforeend', ICON_BELL);
  bell.appendChild(mk('span', '', 'แจ้งเตือน'));
  const dot = mk('span', 'dot');
  dot.id = 'admin-unread-dot';
  dot.hidden = true;
  bell.appendChild(dot);

  const role = mk('span', 'admin-role', user && user.role === 'super_admin' ? 'Super Admin' : 'Admin');
  const right = mk('div', 'admin-topbar-actions');
  right.append(bell, role, renderAccountMenu(user));
  const title = bar.dataset.title;
  bar.replaceChildren(mk('span', 'admin-crumb', 'หลังบ้านระบบประมูล'), right);

  // หัวข้อหน้าอยู่ในเนื้อหา (ตามภาพ)
  const content = document.querySelector('.admin-content');
  if (title && content && !content.querySelector('.admin-page-title')) {
    content.prepend(mk('h1', 'admin-page-title', title));
  }
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
