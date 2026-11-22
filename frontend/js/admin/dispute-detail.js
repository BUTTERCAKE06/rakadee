// admin/dispute-detail.js — รายละเอียด + เปลี่ยนสถานะ + ตัดสินข้อพิพาท (api-spec 9.2, 9.5, 9.6) เจ้าของ: QA
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const disputeId = Number(qa.qs('id'));
  let dispute = null;

  function evidence(host, items) {
    host.replaceChildren(...(items.length
      ? items.map((e) => qa.thumb(e.url, [e.note, qa.dateTime(e.createdAt)].filter(Boolean).join(' · ')))
      : [el('p', { class: 'muted', text: 'ยังไม่มีหลักฐาน' })]));
  }

  function render(d) {
    dispute = d;
    const o = d.order;
    document.title = `ข้อพิพาท ${qa.disputeCode(d.id)} — Admin | Rakadee`;
    $('page-title').textContent = `ข้อพิพาท ${qa.disputeCode(d.id)}`;
    $('status-pill').replaceChildren(qa.pill(qa.DISPUTE_STATUS, d.status));

    $('buyer-title').textContent = `หลักฐานผู้ซื้อ (${o.buyer.displayName})`;
    $('seller-title').textContent = `หลักฐานผู้ขาย (${o.seller.displayName})`;
    $('buyer-desc').textContent = `${qa.DISPUTE_TYPE[d.type] || d.type} — ${d.description}${d.contactInfo ? ` · ติดต่อ: ${d.contactInfo}` : ''}`;
    $('seller-desc').textContent = o.shipment
      ? `หลักฐานการส่ง ${o.shipment.carrierOther || o.shipment.carrier} ${o.shipment.trackingNumber}`
      : 'ภาพก่อนแพ็ก / หลักฐานการส่ง';
    evidence($('buyer-evidence'), d.evidence.filter((e) => e.party === 'buyer'));
    evidence($('seller-evidence'), d.evidence.filter((e) => e.party === 'seller'));

    const events = (o.timeline || []).map((t) => ({ label: qa.ORDER_EVENT[t.event] || t.event, at: t.at }));
    events.push({ label: 'เปิดข้อพิพาท', at: d.openedAt });
    if (d.resolvedAt) events.push({ label: `ตัดสิน: ${qa.RESOLUTION[d.resolution]}`, at: d.resolvedAt });
    events.sort((a, b) => new Date(a.at) - new Date(b.at));
    $('timeline-title').textContent = `ไทม์ไลน์คำสั่งซื้อ ${qa.orderCode(d.orderId)} · ${qa.label(qa.ORDER_STATUS, o.status)} · Escrow ${o.escrow ? qa.label(qa.ESCROW_STATUS, o.escrow.status) : '-'}`;
    $('timeline').replaceChildren(...events.map((e) => el('li', {}, el('span', { text: e.label }), el('span', { class: 'muted', text: qa.dateTime(e.at) }))));

    const closed = d.status === 'closed';
    $('actions').hidden = closed;
    $('result-box').hidden = !closed;
    if (closed) {
      $('result-box').replaceChildren(el('h2', { class: 'qa-card-title', text: `ผลการตัดสิน: ${qa.RESOLUTION[d.resolution] || '-'}` }),
        el('p', { style: 'margin:0;', text: d.adminNote || '' }),
        el('p', { class: 'muted', style: 'margin:4px 0 0;', text: `ตัดสินเมื่อ ${qa.dateTime(d.resolvedAt)} · คำสั่งซื้อ: ${qa.label(qa.ORDER_STATUS, o.status)}` }));
    } else if (qa.DISPUTE_STEPS.includes(d.status) && d.status !== 'open') {
      $('status-select').value = d.status;
    }
    $('content').hidden = false;
  }

  async function load() {
    try {
      render(await api.get(`/disputes/${disputeId}`));
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
  }

  async function updateStatus() {
    const btn = $('btn-status');
    btn.disabled = true;
    try {
      await api.patch(`/admin/disputes/${disputeId}/status`, {
        status: $('status-select').value,
        note: $('status-note').value.trim() || undefined,
      });
      $('status-note').value = '';
      qa.alertBox($('alert-area'), 'บันทึกสถานะแล้ว', 'success');
      await load();
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // Modal ยืนยันการตัดสิน (ดีไซน์ "ยืนยันการตัดสินข้อพิพาท") — บังคับเหตุผล
  function resolve(resolution) {
    const input = el('input', { type: 'text', id: 'resolve-note', maxlength: 1000, placeholder: 'สรุปเหตุผลการตัดสิน (บันทึกใน Audit Log)' });
    const err = el('span', { class: 'field-error', id: 'err-adminNote' });
    qa.modal({
      title: 'ยืนยันการตัดสินข้อพิพาท',
      body: el('div', {},
        el('p', { class: 'muted', style: 'margin-top:0;', text: `การตัดสินไม่สามารถย้อนกลับได้ ระบบจะเปลี่ยนสถานะ Escrow ตามผลทันที (${qa.RESOLUTION[resolution]})` }),
        el('div', 'form-group',
          el('label', { for: 'resolve-note', text: 'เหตุผล (บังคับกรอก)' }), input,
          // ภาพเขียนว่า "ผู้ใช้จะได้รับเหตุผลนี้ทางแจ้งเตือนและอีเมล" แต่ยังไม่มี event แจ้งผลข้อพิพาท จึงเขียนตามที่ระบบทำจริง
          el('span', { class: 'hint', text: 'คู่กรณีจะเห็นเหตุผลนี้ในหน้าข้อพิพาท' }), err)),
      confirmText: 'ยืนยันการตัดสิน',
      confirmClass: 'btn-navy',
      onConfirm: async () => {
        const adminNote = input.value.trim();
        if (!adminNote) {
          err.textContent = 'กรุณาระบุเหตุผลการตัดสิน';
          throw new Error('กรุณาระบุเหตุผลการตัดสิน');
        }
        const res = await api.post(`/admin/disputes/${disputeId}/resolve`, { resolution, adminNote });
        qa.alertBox($('alert-area'), `ตัดสินแล้ว: คำสั่งซื้อ ${qa.label(qa.ORDER_STATUS, res.orderStatus)}, Escrow ${qa.label(qa.ESCROW_STATUS, res.escrowStatus)}`, 'success');
        await load();
      },
    });
  }

  document.addEventListener('user:ready', (e) => {
    const user = e.detail;
    if (!qa.requireAdmin(user)) return;
    if (!disputeId) { qa.alertBox($('alert-area'), 'ไม่พบเลขข้อพิพาท'); return; }
    $('btn-status').addEventListener('click', updateStatus);
    $('btn-refund').addEventListener('click', () => resolve('refund_buyer'));
    $('btn-release').addEventListener('click', () => resolve('release_seller'));
    load();
  });
})();
