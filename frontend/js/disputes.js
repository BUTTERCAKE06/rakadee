// disputes.js — ข้อพิพาท: ผู้ซื้อติดตามสถานะ (ภาพ 22) / ผู้ขายส่งหลักฐาน (ภาพ 38) api-spec 9.2, 9.3 เจ้าของ: QA
// ลิงก์จากแจ้งเตือน DISPUTE_OPENED และหลังเปิดข้อพิพาท: /pages/disputes.html?id=<disputeId>
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const disputeId = Number(qa.qs('id'));
  let me = null;
  let picker;

  // ขั้น 2–5 แอดมินเลือกใช้หรือข้ามได้ และระบบไม่เก็บประวัติว่าผ่านขั้นไหนมาบ้าง
  // จึงทำเครื่องหมาย "ผ่านแล้ว" เฉพาะขั้น 1 ส่วนขั้นอื่นไฮไลต์เมื่อเป็นขั้นปัจจุบันเท่านั้น
  function renderStepper(status) {
    const idx = qa.DISPUTE_STEPS.indexOf(status);
    $('stepper').replaceChildren(...qa.DISPUTE_STEPS.map((s, i) => el('li', {
      class: i === idx ? 'current' : i === 0 ? 'done' : '',
      'aria-current': i === idx ? 'step' : null,
    }, el('b', { text: i + 1 }), qa.DISPUTE_STATUS[s][0])));
  }

  function renderEvidence(host, items, emptyText) {
    host.replaceChildren(...(items.length
      ? items.map((e) => qa.thumb(e.url, [e.note, qa.dateTime(e.createdAt)].filter(Boolean).join(' · ')))
      : [el('p', { class: 'muted', text: emptyText })]));
  }

  function renderTimeline(d) {
    const events = (d.order.timeline || [])
      .filter((t) => t.event !== 'completed' && t.event !== 'cancelled')
      .map((t) => ({ label: qa.ORDER_EVENT[t.event] || t.event, at: t.at }));
    events.push({ label: 'ผู้ซื้อเปิดข้อพิพาท — ล็อกเงิน Escrow', at: d.openedAt });
    events.sort((a, b) => new Date(a.at) - new Date(b.at));
    events.push(d.status === 'closed'
      ? { label: `แอดมินตัดสิน: ${qa.RESOLUTION[d.resolution] || '-'}`, at: d.resolvedAt }
      : { label: 'แอดมินตัดสิน (คืนเงิน / ปล่อยเงิน)', pending: true });
    $('timeline').replaceChildren(...events.map((e) => el('li', { class: e.pending ? 'pending' : '' },
      el('strong', { text: e.label }), el('small', { text: e.pending ? '' : qa.date(e.at) }))));
  }

  function resultNodes(d) {
    return [el('h2', { class: 'qa-card-title', text: `ผลการตัดสิน: ${qa.RESOLUTION[d.resolution] || '-'}` }),
      el('p', { style: 'margin:0;', text: d.adminNote || '' }),
      el('p', { class: 'muted', style: 'margin:4px 0 0;', text: `ตัดสินเมื่อ ${qa.dateTime(d.resolvedAt)}` })];
  }

  function renderSeller(d) {
    // layout ผู้ขาย: มี sidebar ผู้ขาย
    $('layout').classList.add('account-layout');
    $('seller-nav').hidden = false;
    $('seller-view').hidden = false;
    $('buyer-view').hidden = true;
    $('status-pill').replaceChildren();
    $('seller-pill').replaceChildren(qa.pill(qa.DISPUTE_STATUS_SELLER, d.status));
    const type = qa.DISPUTE_TYPE[d.type] || d.type;
    // ตามภาพ 38: ประโยคสั้น ไม่มีรายละเอียดเต็ม (รายละเอียดที่ผู้ซื้อเขียนดูได้จาก tooltip)
    $('seller-summary').textContent = d.status === 'closed'
      ? `ผู้ซื้อแจ้งว่า${type} — แอดมินตัดสินแล้ว`
      : `ผู้ซื้อแจ้งว่า${type} — เงินใน Escrow ถูกล็อกจนกว่าแอดมินตัดสิน`;
    $('seller-summary').title = `รายละเอียดจากผู้ซื้อ: ${d.description}`;
    $('seller-result').replaceChildren(...(d.status === 'closed' ? [el('div', { class: 'qa-info-box is-plain', style: 'margin-bottom:12px;' }, ...resultNodes(d))] : []));
    renderEvidence($('seller-own-evidence'), d.evidence.filter((e) => e.party === 'seller'), 'ยังไม่ได้ส่งหลักฐาน');
    $('drop').classList.add('is-compact');
    const form = $('evidence-form');
    form.hidden = d.status === 'closed';
    if (!form.hidden && form.parentElement !== $('seller-view')) $('seller-view').append(form);
    $('drop-label').textContent = 'อัปโหลดหลักฐานของผู้ขาย (ภาพก่อนแพ็ก / หลักฐานการส่ง)';
  }

  function renderBuyer(d) {
    $('buyer-view').hidden = false;
    $('seller-view').hidden = true;
    $('status-pill').replaceChildren(qa.pill(qa.DISPUTE_STATUS, d.status));
    renderStepper(d.status);
    $('buyer-desc').textContent = `${qa.DISPUTE_TYPE[d.type] || d.type} — ${d.description}`;
    renderEvidence($('buyer-evidence'), d.evidence.filter((e) => e.party === 'buyer'), 'ไม่ได้แนบรูปหลักฐาน');
    renderEvidence($('seller-evidence'), d.evidence.filter((e) => e.party === 'seller'), '');
    $('result-box').hidden = d.status !== 'closed';
    if (d.status === 'closed') $('result-box').replaceChildren(...resultNodes(d));
    $('btn-show-upload').hidden = d.status === 'closed' || !$('evidence-form').hidden;
    if (d.status === 'closed') $('evidence-form').hidden = true;
    $('drop-label').textContent = 'อัปโหลดรูปหลักฐานเพิ่ม';
    renderTimeline(d);
  }

  function render(d) {
    document.title = `ข้อพิพาท ${qa.disputeCode(d.id)} — Rakadee`;
    $('page-title').textContent = `ข้อพิพาท ${qa.disputeCode(d.id)}`;
    if (me.id === d.order.seller.id) renderSeller(d);
    else renderBuyer(d);
  }

  async function load() {
    try {
      render(await api.get(`/disputes/${disputeId}`));
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
  }

  async function onSubmitEvidence(e) {
    e.preventDefault();
    qa.clearFieldErrors();
    if (!picker.files.length) { $('err-files').textContent = 'กรุณาแนบรูปหลักฐานอย่างน้อย 1 รูป'; return; }
    const fd = new FormData();
    picker.files.forEach((f) => fd.append('files', f, f.name));
    if ($('note').value.trim()) fd.append('note', $('note').value.trim());
    const btn = $('btn-evidence');
    btn.disabled = true;
    try {
      await api.upload(`/disputes/${disputeId}/evidence`, fd);
      picker.clear();
      $('note').value = '';
      qa.alertBox($('alert-area'), 'ส่งหลักฐานแล้ว', 'success');
      await load();
    } catch (err) {
      if (!(err.code === 'VALIDATION_ERROR' && qa.fieldErrors(err.details))) qa.alertBox($('alert-area'), err.message);
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    picker = qa.filePicker({ drop: $('drop'), input: $('files'), preview: $('preview'), max: 5 });
    picker.onError = (errs) => { $('err-files').textContent = errs.join(' · '); };
    $('evidence-form').addEventListener('submit', onSubmitEvidence);
    $('btn-show-upload').addEventListener('click', () => {
      const form = $('evidence-form');
      form.classList.add('card');
      form.style.marginTop = '16px';
      $('buyer-view').insertBefore(form, $('buyer-view').lastElementChild);
      form.hidden = false;
      $('btn-show-upload').hidden = true;
    });
  });

  document.addEventListener('user:ready', (e) => {
    me = e.detail;
    if (!me) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (!disputeId) { qa.alertBox($('alert-area'), 'ไม่พบเลขข้อพิพาท'); return; }
    if (me.role === 'admin' || me.role === 'super_admin') {
      location.replace(`/pages/admin/dispute-detail.html?id=${disputeId}`);
      return;
    }
    load();
  });
})();
