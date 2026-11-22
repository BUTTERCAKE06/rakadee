// admin/seller-application.js — รายละเอียดผู้สมัคร + อนุมัติ/ไม่อนุมัติ (api-spec 3.6–3.8, D-18) เจ้าของ: QA
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const userId = Number(qa.qs('userId'));

  function kv(host, pairs) {
    host.replaceChildren(...pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v instanceof Node ? v : String(v ?? '-'))]));
  }
  const verified = (ok) => el('span', { class: ok ? 'badge-verified' : 'field-error', text: ok ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน' });
  const addressText = (a) => (a ? `${a.recipientName} (${a.phone}) ${a.addressLine} ${a.subDistrict} ${a.district} ${a.province} ${a.postalCode}` : 'ไม่มี (ผู้ใช้ลบที่อยู่แล้ว)');

  function render(d) {
    const { user, profile, stats, penalties } = d;
    $('page-title').textContent = `คำขอเปิดร้าน — ${profile.shopName}`;
    $('status-pill').replaceChildren(qa.pill(qa.SHOP_STATUS, profile.status));
    const ageDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);

    kv($('user-kv'), [
      ['ชื่อจริง', user.fullName],
      ['ชื่อที่แสดง', `${user.displayName} (@${user.username})`],
      ['อีเมล', el('span', {}, `${user.email} `, verified(user.emailVerified))],
      ['เบอร์โทร', el('span', {}, `${user.phone} `, verified(user.phoneVerified))],
      ['เลขบัตรประชาชน', user.idCardLast4 ? `*********${user.idCardLast4}` : '-'],
      ['สถานะบัญชี', qa.pill(qa.USER_STATUS, user.status)],
      ['อายุบัญชี', `${ageDays} วัน (สมัคร ${qa.date(user.createdAt)})`],
    ]);
    const shopPairs = [
      ['ชื่อร้าน', profile.shopName],
      ['รายละเอียด', profile.shopDescription || '-'],
      ['จังหวัดต้นทาง', profile.originProvince],
      ['ที่อยู่ส่งของ/รับคืน', addressText(profile.address)],
      ['ยื่นเมื่อ', qa.dateTime(profile.submittedAt)],
    ];
    if (profile.reviewedAt) shopPairs.push(['ตรวจเมื่อ', qa.dateTime(profile.reviewedAt)]);
    if (profile.rejectReason) shopPairs.push(['เหตุผลที่ไม่อนุมัติ', profile.rejectReason]);
    kv($('shop-kv'), shopPairs);
    kv($('stats-kv'), [
      ['จำนวนครั้งที่บิด', stats.bidCount],
      ['ชนะประมูล', stats.wonCount],
      ['คำสั่งซื้อสำเร็จ', stats.completedOrders],
      ['คำสั่งซื้อที่ถูกยกเลิก', stats.cancelledOrders],
    ]);
    $('penalties').replaceChildren(...(penalties.length ? penalties.map((p) => el('li', {},
      el('span', {}, el('strong', { text: qa.PENALTY_TYPE[p.type] || p.type }), ` · ${qa.PENALTY_ACTION[p.action] || p.action}`,
        p.note ? el('div', { class: 'muted', text: p.note }) : ''),
      el('span', { class: 'muted', text: qa.date(p.createdAt) })))
      : [el('li', { class: 'muted', text: 'ไม่มีประวัติความผิด' })]));

    $('actions').hidden = profile.status !== 'pending';
    // บัญชีถูกแบน: ซ่อนปุ่มอนุมัติ (BE ปฏิเสธซ้ำ) เหลือปุ่มไม่อนุมัติ
    const banned = user.status === 'banned';
    $('btn-approve').hidden = banned;
    if (banned && profile.status === 'pending') {
      qa.alertBox($('alert-area'), 'บัญชีนี้ถูกแบนอยู่ อนุมัติเป็นผู้ขายไม่ได้ กด "ไม่อนุมัติ" พร้อมระบุเหตุผลได้');
    }
    $('content').hidden = false;
  }

  async function load() {
    try {
      render(await api.get(`/admin/seller-applications/${userId}`));
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
  }

  function approve() {
    qa.modal({
      title: 'อนุมัติร้านค้า',
      body: el('p', { text: 'ผู้สมัครจะได้สิทธิ์ผู้ขายทันทีและได้รับแจ้งเตือน การอนุมัติจะถูกบันทึกใน Audit Log' }),
      confirmText: 'ยืนยันอนุมัติ',
      onConfirm: async () => {
        await api.post(`/admin/seller-applications/${userId}/approve`);
        qa.alertBox($('alert-area'), 'อนุมัติร้านแล้ว ผู้ใช้เป็นผู้ขาย', 'success');
        load();
      },
    });
  }

  function reject() {
    const input = el('textarea', { id: 'reject-reason', rows: 3, maxlength: 500, placeholder: 'เช่น ที่อยู่ไม่ครบ / ชื่อร้านไม่เหมาะสม' });
    const err = el('span', { class: 'field-error', id: 'err-reason' });
    qa.modal({
      title: 'ไม่อนุมัติร้านค้า',
      body: el('div', 'form-group',
        el('label', { for: 'reject-reason', text: 'เหตุผล (บังคับกรอก)' }), input,
        el('span', { class: 'hint', text: 'ผู้สมัครจะเห็นเหตุผลนี้ และแก้ข้อมูลแล้วยื่นใหม่ได้' }), err),
      confirmText: 'ยืนยันไม่อนุมัติ',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const reason = input.value.trim();
        if (!reason) {
          err.textContent = 'กรุณาระบุเหตุผล';
          throw new Error('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
        }
        await api.post(`/admin/seller-applications/${userId}/reject`, { reason });
        qa.alertBox($('alert-area'), 'บันทึกผลไม่อนุมัติแล้ว', 'success');
        load();
      },
    });
  }

  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!qa.requireAdmin(user)) return;
    if (!userId) { qa.alertBox($('alert-area'), 'ไม่พบรหัสผู้สมัคร'); return; }
    $('btn-approve').addEventListener('click', approve);
    $('btn-reject').addEventListener('click', reject);
    load();
  });
})();
