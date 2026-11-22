// Admin Dashboard: การ์ดสถิติ (api-spec 11.5) + กราฟ (api-spec 11.6) — requirement 8.2-1 — เจ้าของ: PM
// กราฟใช้ Chart.js ที่เก็บไว้ใน /vendor (ไม่พึ่ง CDN ตอนเดโม)
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
      card({ label: 'ร้านค้ารออนุมัติ', value: num(d.sellers.pendingReview), href: '/pages/admin/sellers.html',
        attention: d.sellers.pendingReview > 0, sub: 'ตรวจสอบผู้ขายก่อนเปิดร้าน (D-18)' }),
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

  // ---------------------------------------------------------------- กราฟ (11.6)
  const STATUS_LABEL = {
    pending_payment: 'รอชำระเงิน', awaiting_shipment: 'รอจัดส่ง', shipped: 'กำลังจัดส่ง',
    completed: 'สำเร็จ', disputed: 'มีข้อพิพาท', cancelled: 'ยกเลิก',
  };
  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();
  const palette = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => color(`--chart-${i}`));
  const charts = {};

  // วันที่ YYYY-MM-DD → "22 พ.ย." (สัปดาห์: "สัปดาห์ 16 พ.ย.")
  function axisLabel(ymd, group) {
    const d = new Date(`${ymd}T00:00:00Z`);
    const text = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return group === 'week' ? `สัปดาห์ ${text}` : text;
  }

  function draw(id, config, isEmpty) {
    const canvas = $(id);
    const box = canvas.parentElement;
    let empty = box.querySelector('.chart-empty');
    if (isEmpty) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.textContent = 'ยังไม่มีข้อมูลในช่วงเวลานี้';
        box.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, config);
  }

  const bahtTick = (v) => baht(v);
  const pieLegend = () => (window.innerWidth < 600 ? 'bottom' : 'right');
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
  };

  function renderCharts(d) {
    const labels = d.labels.map((l) => axisLabel(l, d.group));
    const allZero = (arr) => arr.every((v) => !v);

    draw('chart-sales', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'ยอดปิดการขาย', data: d.salesValue, backgroundColor: palette[0], borderRadius: 4 }] },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${baht(c.raw)} (${num(d.completedAuctions[c.dataIndex])} รายการ)` } },
        },
        scales: { y: { beginAtZero: true, ticks: { callback: bahtTick } }, x: { grid: { display: false } } },
      },
    }, allZero(d.salesValue));

    draw('chart-money', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'เงินที่ชำระ (GMV)', data: d.gmv, backgroundColor: palette[0], borderRadius: 4 },
          { label: 'ค่าธรรมเนียม', data: d.fees, backgroundColor: palette[1], borderRadius: 4 },
        ],
      },
      options: {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${baht(c.raw)}` } } },
        scales: { y: { beginAtZero: true, ticks: { callback: bahtTick } }, x: { grid: { display: false } } },
      },
    }, allZero(d.gmv) && allZero(d.fees));

    const total = d.byCategory.reduce((s, c) => s + c.value, 0);
    draw('chart-category', {
      type: 'doughnut',
      data: {
        labels: d.byCategory.map((c) => c.name),
        datasets: [{ data: d.byCategory.map((c) => c.value), backgroundColor: d.byCategory.map((_, i) => palette[i % palette.length]) }],
      },
      options: {
        ...baseOptions,
        interaction: undefined,
        plugins: {
          ...baseOptions.plugins,
          legend: { position: pieLegend(), labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (c) => {
                const cat = d.byCategory[c.dataIndex];
                const pct = total ? Math.round((cat.value / total) * 100) : 0;
                return `${cat.name}: ${baht(cat.value)} (${pct}%, ${num(cat.count)} รายการ)`;
              },
            },
          },
        },
      },
    }, !total);

    const statuses = d.orderStatus.filter((s) => s.count > 0);
    draw('chart-status', {
      type: 'doughnut',
      data: {
        labels: statuses.map((s) => STATUS_LABEL[s.status] || s.status),
        datasets: [{
          data: statuses.map((s) => s.count),
          backgroundColor: statuses.map((s) => palette[d.orderStatus.findIndex((x) => x.status === s.status) % palette.length]),
        }],
      },
      options: {
        ...baseOptions,
        interaction: undefined,
        plugins: {
          ...baseOptions.plugins,
          legend: { position: pieLegend(), labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${num(c.raw)} รายการ` } },
        },
      },
    }, !statuses.length);
  }

  async function loadCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = color('--font');
    const q = new URLSearchParams({ range: $('chart-range').value, group: $('chart-group').value });
    try {
      renderCharts(await api.get(`/admin/dashboard/charts?${q}`));
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
    loadCharts();
    $('chart-range').addEventListener('change', loadCharts);
    $('chart-group').addEventListener('change', loadCharts);
    setInterval(load, 60 * 1000);
  });
})();
