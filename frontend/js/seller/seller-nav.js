// seller-nav.js — sidebar หน้าผู้ขายตามภาพ UI (แดชบอร์ด / สินค้าของฉัน / ลงสินค้าใหม่ / รอจัดส่ง / การเงินผู้ขาย / ข้อพิพาท)
// เจ้าของ: QA · ใช้: <aside class="account-nav" id="seller-nav"></aside> แล้วโหลดไฟล์นี้หลัง /js/layout.js
// เมนูที่ยังไม่มีหน้า (ready: false) แสดงเป็นตัวจางกดไม่ได้ พร้อม tooltip บอกเจ้าของ — เจ้าของหน้าเปลี่ยนเป็น true เมื่อทำเสร็จ
'use strict';

(() => {
  const ITEMS = [
    { href: '/pages/seller/dashboard.html', label: 'แดชบอร์ดผู้ขาย', ready: true },
    { href: '/pages/seller/listings.html', label: 'สินค้าของฉัน', ready: true, match: ['/pages/seller/listing-preview.html'] },
    { href: '/pages/seller/listing-form.html', label: 'ลงสินค้าใหม่', ready: true },
    { href: '/pages/seller/shipments.html', label: 'รอจัดส่ง', ready: true },   // PM (API 8.3)
    { href: '/pages/wallet.html', label: 'การเงินผู้ขาย', ready: true },        // SA: ยอดรอรับ + ประวัติรายได้ (API 7.1, 7.3) อยู่ในหน้า Wallet
    { href: '/pages/seller/disputes.html', label: 'ข้อพิพาท', ready: true, match: ['/pages/disputes.html'] },
  ];

  function render() {
    const host = document.getElementById('seller-nav');
    if (!host) return;
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'เมนูผู้ขาย');
    const label = document.createElement('span');
    label.className = 'seller-nav-label';
    label.textContent = 'ผู้ขาย';
    nav.appendChild(label);

    ITEMS.forEach((item) => {
      const active = location.pathname === item.href || (item.match || []).includes(location.pathname);
      let node;
      if (item.ready || active) {
        node = document.createElement('a');
        node.href = active && !item.ready ? location.href : item.href;
        if (active) { node.className = 'active'; node.setAttribute('aria-current', 'page'); }
      } else {
        node = document.createElement('span');
        node.className = 'is-disabled';
        node.title = item.note;
        node.setAttribute('aria-disabled', 'true');
      }
      node.textContent = item.label;
      nav.appendChild(node);
    });
    host.replaceChildren(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
