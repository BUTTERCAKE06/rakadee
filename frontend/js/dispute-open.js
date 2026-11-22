// dispute-open.js — ผู้ซื้อเปิดข้อพิพาท (api-spec 9.1) เจ้าของ: QA
// เปิดหน้า: /pages/dispute-open.html?orderId=<id> (ปุ่ม "แจ้งปัญหา" ในหน้าคำสั่งซื้อของ PM ลิงก์มาที่นี่)
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const orderId = Number(qa.qs('orderId'));
  let picker;

  function validate() {
    const errors = {};
    if (!$('type').value) errors.type = 'กรุณาเลือกประเภทปัญหา';
    if ($('description').value.trim().length < 10) errors.description = 'กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร';
    qa.fieldErrors(errors);
    return !Object.keys(errors).length;
  }

  async function onSubmit(e) {
    e.preventDefault();
    qa.clearFieldErrors();
    qa.alertBox($('alert-area'), '');
    if (!validate()) return;

    const fd = new FormData();
    fd.append('type', $('type').value);
    fd.append('description', $('description').value.trim());
    if ($('contactInfo').value.trim()) fd.append('contactInfo', $('contactInfo').value.trim());
    picker.files.forEach((f) => fd.append('files', f, f.name));

    const btn = $('btn-submit');
    btn.disabled = true;
    try {
      const res = await api.upload(`/orders/${orderId}/disputes`, fd);
      location.href = `/pages/disputes.html?id=${res.disputeId}`;
    } catch (err) {
      btn.disabled = false;
      if (err.code === 'VALIDATION_ERROR' && qa.fieldErrors(err.details)) return;
      qa.alertBox($('alert-area'), err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    picker = qa.filePicker({ drop: $('drop'), input: $('files'), preview: $('preview'), max: 5 });
    picker.onError = (errs) => { $('err-files').textContent = errs.join(' · '); };
    $('form-dispute').addEventListener('submit', onSubmit);
  });

  document.addEventListener('user:ready', (e) => {
    if (!e.detail) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (!orderId) {
      qa.alertBox($('alert-area'), 'ไม่พบเลขคำสั่งซื้อ กรุณาเปิดจากหน้าคำสั่งซื้อ');
      $('btn-submit').disabled = true;
      return;
    }
    $('page-title').textContent = `แจ้งปัญหา คำสั่งซื้อ ${qa.orderCode(orderId)}`;
    checkOrder();
  });

  // เช็กก่อนกรอกจาก 8.2 (PM) ว่าเปิดข้อพิพาทได้ไหม จะได้ไม่ต้องกรอกทั้งฟอร์มแล้วค่อยรู้ตอนส่ง
  // ถ้าเรียกไม่สำเร็จ ปล่อยให้กรอกได้ตามเดิม BE 9.1 ตรวจซ้ำอยู่แล้ว
  async function checkOrder() {
    let o;
    try { o = await api.get(`/orders/${orderId}`); } catch (err) {
      if (err.status === 404) { block('ไม่พบคำสั่งซื้อนี้ หรือคุณไม่ใช่ผู้ซื้อของคำสั่งซื้อนี้'); }
      return;
    }
    if (o.viewerRole && o.viewerRole !== 'buyer') { block('เปิดข้อพิพาทได้เฉพาะผู้ซื้อของคำสั่งซื้อนี้'); return; }
    if (o.dispute && o.dispute.status !== 'closed') {
      block('คำสั่งซื้อนี้มีข้อพิพาทที่ยังไม่ปิดอยู่แล้ว', { href: `/pages/disputes.html?id=${o.dispute.id}`, text: 'ดูข้อพิพาท' });
      return;
    }
    if (o.canOpenDispute === false) {
      block('คำสั่งซื้อนี้เปิดข้อพิพาทไม่ได้ (เปิดได้เฉพาะช่วงรอจัดส่ง / จัดส่งแล้ว และก่อนเงินถูกปล่อยให้ผู้ขาย)',
        { href: `/pages/orders.html?id=${orderId}`, text: 'กลับไปหน้าคำสั่งซื้อ' });
    }
  }

  function block(message, link) {
    qa.alertBox($('alert-area'), message);
    if (link) $('alert-area').firstChild.append(' ', qa.el('a', { href: link.href, text: link.text }));
    $('form-dispute').hidden = true;
  }
})();
