// หน้าการแจ้งเตือน (api-spec 11.1–11.4) — เจ้าของ: PM
(() => {
  const GROUP_LABEL = { auction: 'การประมูล', finance: 'การเงิน', shipping: 'การจัดส่ง' };
  const state = { group: '', unread: false, page: 1, limit: 20 };
  const $ = (id) => document.getElementById(id);

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 172800) return 'เมื่อวาน';
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function showError(message) {
    const box = $('alert');
    box.replaceChildren();
    if (!message) return;
    const div = document.createElement('div');
    div.className = 'alert alert-error';
    div.textContent = message;
    box.appendChild(div);
  }

  async function markRead(n, li) {
    if (n.isRead) return;
    try {
      const d = await api.post(`/notifications/${n.id}/read`);
      n.isRead = true;
      li.classList.remove('unread');
      window.layout.setUnread(d.unreadCount);
    } catch (e) {
      showError(e.message);
    }
  }

  function renderItem(n) {
    const li = document.createElement('li');
    li.className = `notif-item${n.isRead ? '' : ' unread'}`;
    const dot = document.createElement('span');
    dot.className = 'notif-dot';
    const body = document.createElement('div');
    body.className = 'notif-body';
    const title = document.createElement(n.linkUrl ? 'a' : 'strong');
    title.textContent = n.title;
    if (n.linkUrl) {
      title.href = n.linkUrl;
      title.addEventListener('click', () => markRead(n, li));
    }
    const msg = document.createElement('p');
    msg.className = 'notif-msg';
    msg.textContent = n.message;
    const tag = document.createElement('span');
    tag.className = 'notif-tag';
    tag.textContent = GROUP_LABEL[n.group] || '';
    body.append(title, msg, tag);
    const time = document.createElement('time');
    time.className = 'notif-time';
    time.dateTime = n.createdAt;
    time.textContent = timeAgo(n.createdAt);
    li.append(dot, body, time);
    if (!n.isRead && !n.linkUrl) li.addEventListener('click', () => markRead(n, li));
    return li;
  }

  function renderPager(total) {
    const pages = Math.max(1, Math.ceil(total / state.limit));
    const pager = $('pager');
    pager.replaceChildren();
    if (pages <= 1) return;
    const prev = document.createElement('button');
    prev.className = 'btn';
    prev.textContent = '‹ ก่อนหน้า';
    prev.disabled = state.page <= 1;
    prev.onclick = () => { state.page -= 1; load(); };
    const info = document.createElement('span');
    info.className = 'muted';
    info.textContent = `หน้า ${state.page} / ${pages}`;
    const next = document.createElement('button');
    next.className = 'btn';
    next.textContent = 'ถัดไป ›';
    next.disabled = state.page >= pages;
    next.onclick = () => { state.page += 1; load(); };
    pager.append(prev, info, next);
  }

  async function load() {
    const q = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.group) q.set('group', state.group);
    if (state.unread) q.set('unread', 'true');
    const list = $('list');
    try {
      const d = await api.get(`/notifications?${q}`);
      showError('');
      list.replaceChildren(...d.items.map(renderItem));
      if (!d.items.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = state.unread ? 'ไม่มีการแจ้งเตือนที่ยังไม่อ่าน' : 'ยังไม่มีการแจ้งเตือน';
        list.appendChild(li);
      }
      window.layout.setUnread(d.unreadCount);
      renderPager(d.total);
    } catch (e) {
      showError(e.message);
    }
  }

  document.addEventListener('user:ready', (e) => {
    if (!e.detail) { location.href = '/pages/login.html?next=' + encodeURIComponent(location.pathname); return; }

    $('tabs').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-group]');
      if (!btn) return;
      $('tabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      state.group = btn.dataset.group;
      state.page = 1;
      load();
    });
    $('unread-only').addEventListener('change', (ev) => { state.unread = ev.target.checked; state.page = 1; load(); });
    $('read-all').addEventListener('click', async () => {
      try {
        await api.post('/notifications/read-all');
        window.layout.setUnread(0);
        load();
      } catch (err) {
        showError(err.message);
      }
    });
    // แจ้งเตือนใหม่ real-time: โหลดหน้าแรกใหม่ถ้ากำลังดูหน้าแรก
    document.addEventListener('notification:new', () => { if (state.page === 1) load(); });
    load();
  });
})();
