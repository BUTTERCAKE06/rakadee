// Admin Dashboard: การ์ดสถิติ (api-spec 11.5, requirement 8.2-1) — เจ้าของ: PM
// กราฟรายวัน/สัปดาห์ (api-spec 11.6) อยู่ใน Phase 2
(() => {
  const $ = (id) => document.getElementById(id);
  const num = (n) => Number(n || 0).toLocaleString('th-TH');
  const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

  function card({ label, value, sub, href, attention }) {
    const c = document.createElement(href ? 'a' : 'div');
    c.className = `stat-card${attention ? ' attention' : ''}`;
    if (href) c.href = href;
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'value';
    v.textContent = value;
    c.append(l, v);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sub;
      c.appendChild(s);
    }
    return c;
  }

  function render(d) {
    $('todo').replaceChildren(
      card({ label: 'สินค้ารออนุมัติ', value: num(d.listings.pendingReview), href: '/pages/admin/listings.html',
        attention: d.listings.pendingReview > 0, sub: 'ตรวจสอบและอนุมัติสินค้า' }),
      card({ label: 'การชำระเงินรอตรวจ', value: num(d.orders.paymentReview), href: '/pages/admin/payments.html',
        attention: d.orders.paymentReview > 0, sub: 'ต้องตรวจภายใน 24 ชม.' }),
      card({ label: 'ข้อพิพาทที่เปิดอยู่', value: num(d.disputes.open), href: '/pages/admin/disputes.html',
        attention: d.disputes.open > 0, sub: 'เงินถูกพักไว้จนกว่าจะตัดสิน' }),
    );
    $('users').replaceChildren(
      card({ label: 'สมาชิกทั้งหมด', value: num(d.users.total), sub: `ใหม่วันนี้ ${num(d.users.newToday)} คน` }),
      card({ label: 'รอยืนยันตัวตน', value: num(d.users.pendingVerification), sub: 'ยังไม่ผ่าน OTP' }),
      card({ label: 'บัญชีถูกจำกัด / ระงับ', value: num(d.users.restricted) }),
      card({ label: 'สินค้ากำลังประมูล', value: num(d.listings.active), sub: `ใกล้จบใน 1 ชม. ${num(d.listings.endingWithinHour)} รายการ` }),
    );
    $('orders').replaceChildren(
      card({ label: 'รอชำระเงิน', value: num(d.orders.pendingPayment) }),
      card({ label: 'รอจัดส่ง', value: num(d.orders.awaitingShipment) }),
      card({ label: 'อยู่ระหว่างจัดส่ง', value: num(d.orders.shipped) }),
      card({ label: 'สำเร็จวันนี้', value: num(d.orders.completedToday) }),
      card({ label: 'มูลค่าธุรกรรมวันนี้', value: baht(d.money.gmvToday), sub: 'ยอดที่ชำระสำเร็จวันนี้' }),
      card({ label: 'เงินพักใน Escrow', value: baht(d.money.escrowHeld) }),
      card({ label: 'ค่าธรรมเนียมสะสม', value: baht(d.money.feesCollected) }),
    );
    $('updated').textContent = `อัปเดตล่าสุด ${new Date(d.generatedAt).toLocaleTimeString('th-TH')}`;
  }

  async function load() {
    try {
      render(await api.get('/admin/dashboard'));
      $('alert').replaceChildren();
    } catch (e) {
      const div = document.createElement('div');
      div.className = 'alert alert-error';
      div.textContent = e.message;
      $('alert').replaceChildren(div);
    }
  }

  document.addEventListener('user:ready', (e) => {
    const u = e.detail;
    if (!u) { location.href = '/pages/login.html?next=' + encodeURIComponent(location.pathname); return; }
    if (u.role !== 'admin' && u.role !== 'super_admin') { location.href = '/'; return; }
    load();
    setInterval(load, 60 * 1000);
  });
})();
