// Sidebar หน้าบัญชีสมาชิก (การประมูลของฉัน, Watchlist, ... ตั้งค่า) — เจ้าของ: PM
// ใช้: ใส่ <aside class="account-nav" id="account-nav"></aside> แล้วโหลดไฟล์นี้หลัง /js/layout.js
// หน้าไหนใช้ก็ได้ ลิงก์ของหน้าปัจจุบันจะถูกไฮไลต์อัตโนมัติ
document.addEventListener('user:ready', (e) => {
  const host = document.getElementById('account-nav');
  if (!host) return;
  const user = e.detail;
  const items = [...(window.ACCOUNT_LINKS || [])];
  if (user && (user.role === 'bidder' || user.role === 'seller')) {
    if (user.isSeller) {
      items.push({ href: '/pages/seller/listings.html', label: 'ร้านของฉัน' },
        { href: '/pages/seller/shipments.html', label: 'รอจัดส่ง' });
    } else {
      items.push({ href: '/pages/seller/open-shop.html', label: 'เปิดสิทธิ์ผู้ขาย' });
    }
  } else {
    // แอดมินไม่มีเมนูของสมาชิก เหลือเฉพาะตั้งค่า
    items.splice(0, items.length, { href: '/pages/settings.html', label: 'ตั้งค่า' },
      { href: '/pages/admin/dashboard.html', label: 'ระบบแอดมิน' });
  }
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'เมนูบัญชี');
  items.forEach((item) => {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    if (location.pathname === item.href) a.className = 'active';
    nav.appendChild(a);
  });
  host.replaceChildren(nav);
});
