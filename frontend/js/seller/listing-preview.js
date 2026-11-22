// seller/listing-preview.js — ตัวอย่างสินค้าก่อนส่งตรวจ (ภาพ UI 34, api-spec 4.7 + 5.2) เจ้าของ: QA
// เปิดจากปุ่ม "ดูตัวอย่าง" ในขั้น 4 (ฟอร์มบันทึกร่างให้ก่อนแล้ว) — /pages/seller/listing-preview.html?id=<listingId>
'use strict';

(() => {
  const { el } = qa;
  const $ = (id) => document.getElementById(id);
  const id = Number(qa.qs('id'));
  const CONDITION = { new: ['ของใหม่', 'is-info'], used_good: ['มือสองสภาพดี', 'is-info'], defective: ['มีตำหนิ', 'is-warning'] };

  function render(l) {
    const cover = (l.images || []).find((i) => i.isCover) || (l.images || [])[0];
    if (cover) $('cover').replaceChildren(el('a', { href: cover.url, target: '_blank', rel: 'noopener', title: 'เปิดรูปขนาดเต็ม' }, el('img', { src: cover.url, alt: l.title })));
    $('thumbs').replaceChildren(...(l.images || []).filter((i) => i !== cover).map((i) => qa.thumb(i.url, '')));
    $('cond').replaceChildren(qa.pill(CONDITION, l.itemCondition));
    $('title').textContent = l.title;
    const rows = [
      ['ราคาเริ่มต้น', qa.money(l.startPrice)],
      ['Bid Increment', qa.money(l.bidIncrement)],
      ['Reserve (ซ่อนจากผู้ซื้อ)', l.reservePrice ? qa.money(l.reservePrice) : 'ไม่ตั้ง'],
      ['ซื้อทันที', l.buyNowPrice ? qa.money(l.buyNowPrice) : 'ไม่เปิด'],
      ['ระยะเวลา', l.durationDays ? `${l.durationDays} วัน` : '-'],
      ['ค่าจัดส่ง / ต้นทาง', `${Number(l.shippingFee) === 0 ? 'ส่งฟรี' : qa.money(l.shippingFee)} / ${l.originProvince}`],
    ];
    if (l.category) rows.push(['หมวดหมู่', l.category.parent ? `${l.category.parent.name} › ${l.category.name}` : l.category.name]);
    if (l.defectDetail) rows.push(['ตำหนิ', l.defectDetail]);
    $('kv').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
    $('btn-edit').href = `/pages/seller/listing-form.html?id=${l.id}&step=4`;
    const canSubmit = ['draft', 'rejected'].includes(l.status);
    $('btn-submit').hidden = !canSubmit;
    if (l.status === 'pending_review') qa.alertBox($('alert-area'), 'สินค้านี้ส่งตรวจแล้ว กำลังรอแอดมินอนุมัติ', 'success');
    $('content').hidden = false;
  }

  async function submit() {
    const btn = $('btn-submit');
    btn.disabled = true;
    try {
      await api.post(`/listings/${id}/submit`);
      location.href = '/pages/seller/listings.html?msg=submitted';
    } catch (err) {
      btn.disabled = false;
      qa.alertBox($('alert-area'), err.message);
    }
  }

  document.addEventListener('user:ready', async (e) => {
    const user = e.detail;
    if (!user) { location.href = `/pages/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (user.role !== 'seller') { location.href = '/pages/seller/open-shop.html'; return; }
    if (!id) { qa.alertBox($('alert-area'), 'ไม่พบสินค้า'); return; }
    $('btn-submit').addEventListener('click', submit);
    try {
      const l = await api.get(`/listings/${id}`);
      if (l.durationDays == null) l.durationDays = await qa.ownerDurationDays(l.id, l.status).catch(() => null);
      render(l);
    } catch (err) {
      qa.alertBox($('alert-area'), err.message);
    }
  });
})();
