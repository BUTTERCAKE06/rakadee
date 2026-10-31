// Navbar ที่เปลี่ยนตาม role (ข้อ 1.3, 1.5) ทุกหน้าต้องมี <div id="navbar"></div> และโหลด api.js ก่อนไฟล์นี้
// role: guest, bidder, seller, admin, super_admin
// ผู้ใช้ปัจจุบันดึงจาก GET /api/auth/me (SA ทำ) ถ้ายังไม่มี API นี้จะแสดงแบบ guest
const NAV_LINKS = {
  guest: [
    { href: '/', label: 'หน้าแรก' },
    { href: '/pages/search.html', label: 'ค้นหา' },
    { href: '/pages/help.html', label: 'ช่วยเหลือ' },
  ],
  bidder: [
    { href: '/pages/watchlist.html', label: 'Watchlist' },
    { href: '/pages/my-bids.html', label: 'การประมูลของฉัน' },
    { href: '/pages/orders.html', label: 'คำสั่งซื้อ' },
    { href: '/pages/wallet.html', label: 'Wallet' },
  ],
  seller: [
    { href: '/pages/seller/listings.html', label: 'สินค้าของฉัน' },
    { href: '/pages/seller/shipments.html', label: 'รอจัดส่ง' },
  ],
  admin: [
    { href: '/pages/admin/dashboard.html', label: 'แอดมิน' },
  ],
};

async function getCurrentUser() {
  if (!api.getToken()) return null;
  try {
    return await api.get('/auth/me'); // { id, displayName, roles: ['bidder','seller'], status }
  } catch {
    return null;
  }
}

function linksFor(user) {
  const links = [...NAV_LINKS.guest];
  if (!user) return links;
  const roles = user.roles || [];
  links.push(...NAV_LINKS.bidder);
  if (roles.includes('seller')) links.push(...NAV_LINKS.seller);
  if (roles.includes('admin') || roles.includes('super_admin')) links.push(...NAV_LINKS.admin);
  return links;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderNavbar() {
  const el = document.getElementById('navbar');
  if (!el) return;
  const user = await getCurrentUser();
  const links = linksFor(user)
    .map((l) => `<a href="${l.href}">${escapeHtml(l.label)}</a>`)
    .join('');
  const actions = user
    ? `<span class="muted">${escapeHtml(user.displayName || '')}</span>
       <a class="btn" href="/pages/settings.html">ตั้งค่า</a>
       <button class="btn" id="logout-btn">ออกจากระบบ</button>`
    : `<a class="btn" href="/pages/login.html">เข้าสู่ระบบ</a>
       <a class="btn btn-primary" href="/pages/register.html">สมัครสมาชิก</a>`;

  el.innerHTML = `<nav class="navbar"><div class="container">
      <a class="brand" href="/">Rakadee</a>
      <div class="links">${links}</div>
      <div class="actions">${actions}</div>
    </div></nav>`;

  const logout = document.getElementById('logout-btn');
  if (logout) logout.addEventListener('click', () => { api.setToken(null); location.href = '/'; });

  window.currentUser = user;
  document.dispatchEvent(new CustomEvent('user:ready', { detail: user }));
}

document.addEventListener('DOMContentLoaded', renderNavbar);
