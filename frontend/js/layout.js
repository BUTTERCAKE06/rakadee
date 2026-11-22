// Navbar + Socket.IO กลางของหน้าสมาชิก (ข้อ 1.3, 1.5) — เจ้าของ: PM
// ทุกหน้าต้องมี <div id="navbar"></div> และโหลด /js/api.js ก่อนไฟล์นี้ (หน้าแอดมินใช้ /js/admin/admin-shell.js แทน)
// สิ่งที่ไฟล์นี้ให้หน้าอื่นใช้:
//   window.currentUser                         ผู้ใช้ปัจจุบัน (UserMe จาก GET /api/auth/me) หรือ null
//   document 'user:ready'  (e.detail = user)   ยิงเมื่อรู้แล้วว่าใคร login
//   window.getSocket()                         Socket.IO ที่เชื่อมแล้ว (ส่ง token ให้อัตโนมัติ) ใช้ร่วมกันทั้งหน้า
//   document 'notification:new' (e.detail)     ยิงเมื่อมีแจ้งเตือนใหม่แบบ real-time
//   window.layout.setUnread(n)                 ตั้งตัวเลขบนกระดิ่ง
(() => {
  const ICON = {
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };

  // เมนูบัญชี (ตรงกับ sidebar ในดีไซน์ ใช้ร่วมกับ account-nav.js)
  const ACCOUNT_LINKS = [
    { href: '/pages/my-bids.html', label: 'การประมูลของฉัน' },
    { href: '/pages/watchlist.html', label: 'Watchlist' },
    { href: '/pages/won.html', label: 'รายการที่ชนะ' },
    { href: '/pages/orders.html', label: 'คำสั่งซื้อ' },
    { href: '/pages/wallet.html', label: 'กระเป๋าเงิน' },
    { href: '/pages/notifications.html', label: 'การแจ้งเตือน' },
    { href: '/pages/settings.html', label: 'ตั้งค่า' },
  ];
  window.ACCOUNT_LINKS = ACCOUNT_LINKS;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const link = (href, text, cls) => {
    const a = el('a', cls, text);
    a.href = href;
    return a;
  };
  const initials = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();
  const isAdmin = (u) => u && (u.role === 'admin' || u.role === 'super_admin');
  const isMember = (u) => u && (u.role === 'bidder' || u.role === 'seller');

  async function getCurrentUser() {
    if (!api.getToken()) return null;
    try {
      return await api.get('/auth/me');
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- Socket.IO
  let socketPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  window.getSocket = function getSocket() {
    if (!socketPromise) {
      socketPromise = (window.io ? Promise.resolve() : loadScript('/socket.io/socket.io.js'))
        .then(() => window.io({ auth: { token: api.getToken() || undefined } }))
        .catch(() => null);
    }
    return socketPromise;
  };

  // ---------------------------------------------------------------- Toast
  function toast(n) {
    let box = document.getElementById('toast-box');
    if (!box) {
      box = el('div', 'toast-box');
      box.id = 'toast-box';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    const t = el(n.linkUrl ? 'a' : 'div', 'toast');
    if (n.linkUrl) t.href = n.linkUrl;
    t.append(el('strong', '', n.title), el('span', '', n.message));
    box.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  // ---------------------------------------------------------------- Navbar
  let unreadBadge = null;
  function setUnread(n) {
    if (!unreadBadge) return;
    const count = Number(n) || 0;
    unreadBadge.textContent = count > 99 ? '99+' : String(count);
    unreadBadge.hidden = count === 0;
  }

  function buildBell() {
    const wrap = el('div', 'nav-bell');
    const btn = el('a', 'icon-btn');
    btn.href = '/pages/notifications.html';
    btn.title = 'การแจ้งเตือน';
    btn.setAttribute('aria-label', 'การแจ้งเตือน');
    btn.insertAdjacentHTML('beforeend', ICON.bell);
    unreadBadge = el('span', 'badge-count', '0');
    unreadBadge.hidden = true;
    btn.appendChild(unreadBadge);
    wrap.appendChild(btn);
    return wrap;
  }

  function buildUserMenu(user) {
    const wrap = el('div', 'nav-user');
    const btn = el('button', 'nav-user-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    const avatar = el('span', 'avatar');
    if (user.avatarUrl) {
      const img = el('img');
      img.src = user.avatarUrl;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(user.displayName);
    }
    btn.append(avatar, el('span', 'nav-user-name', user.displayName || user.username));

    const menu = el('div', 'nav-menu');
    menu.hidden = true;
    if (isMember(user)) {
      ACCOUNT_LINKS.forEach((l) => menu.appendChild(link(l.href, l.label)));
      if (user.isSeller) {
        menu.appendChild(link('/pages/seller/listings.html', 'ร้านของฉัน'));
        menu.appendChild(link('/pages/seller/shipments.html', 'รอจัดส่ง'));
      } else {
        menu.appendChild(link('/pages/seller/open-shop.html', 'เปิดสิทธิ์ผู้ขาย'));
      }
    }
    if (isAdmin(user)) {
      menu.appendChild(link('/pages/admin/dashboard.html', 'ระบบแอดมิน'));
      menu.appendChild(link('/pages/settings.html', 'ตั้งค่า'));
    }
    const logout = el('button', 'nav-menu-logout', 'ออกจากระบบ');
    logout.type = 'button';
    logout.addEventListener('click', async () => {
      try { await api.post('/auth/logout'); } catch { /* token หมดอายุแล้วก็ออกได้ */ }
      api.setToken(null);
      location.href = '/';
    });
    menu.appendChild(logout);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', () => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
    wrap.append(btn, menu);
    return wrap;
  }

  function buildSearch() {
    const form = el('form', 'nav-search');
    form.setAttribute('role', 'search');
    form.action = '/pages/search.html';
    form.insertAdjacentHTML('beforeend', ICON.search);
    const input = el('input');
    input.type = 'search';
    input.name = 'q';
    input.placeholder = 'ค้นหาสินค้าประมูล';
    input.setAttribute('aria-label', 'ค้นหาสินค้าประมูล');
    form.appendChild(input);
    return form;
  }

  async function renderNavbar() {
    const host = document.getElementById('navbar');
    const user = await getCurrentUser();
    window.currentUser = user;

    if (host) {
      const nav = el('nav', 'navbar');
      const c = el('div', 'container');
      const brand = link('/', '', 'brand');
      brand.append(el('span', 'brand-logo', 'R'), el('span', '', 'RAKADEE'));

      const links = el('div', 'links');
      links.append(
        link('/', 'หน้าแรก'),
        link('/pages/search.html', 'รายการประมูล'),
        link('/pages/search.html#categories', 'หมวดหมู่'),
        link('/pages/help.html', 'ช่วยเหลือ'),
      );
      if (user && user.isSeller) links.appendChild(link('/pages/seller/dashboard.html', 'ผู้ขาย'));
      if (isAdmin(user)) links.appendChild(link('/pages/admin/dashboard.html', 'แอดมิน'));

      const actions = el('div', 'actions');
      if (user) {
        actions.appendChild(buildBell());
        if (isMember(user)) {
          const wallet = link('/pages/wallet.html', '', 'nav-wallet');
          wallet.hidden = true;
          actions.appendChild(wallet);
          api.get('/wallet')
            .then((w) => { wallet.textContent = `฿${Number(w.balance).toLocaleString('th-TH')}`; wallet.hidden = false; })
            .catch(() => { /* Wallet API (SA) ยังไม่พร้อม ก็ซ่อนไว้ */ });
        }
        actions.appendChild(buildUserMenu(user));
      } else {
        actions.append(link('/pages/login.html', 'เข้าสู่ระบบ', 'btn'), link('/pages/register.html', 'สมัครสมาชิก', 'btn btn-primary'));
      }

      c.append(brand, links, buildSearch(), actions);
      nav.appendChild(c);
      host.replaceChildren(nav);
    }

    document.dispatchEvent(new CustomEvent('user:ready', { detail: user }));

    if (user) {
      api.get('/notifications/unread-count').then((d) => setUnread(d.unreadCount)).catch(() => {});
      const socket = await window.getSocket();
      if (socket) {
        socket.on('notification:new', (n) => {
          setUnread((Number(unreadBadge && unreadBadge.textContent) || 0) + 1);
          toast(n);
          document.dispatchEvent(new CustomEvent('notification:new', { detail: n }));
        });
      }
    }
  }

  window.layout = { setUnread, toast };
  document.addEventListener('DOMContentLoaded', renderNavbar);
})();
