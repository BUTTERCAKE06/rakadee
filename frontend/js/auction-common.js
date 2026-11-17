// ชิ้นส่วนที่หน้าฝั่งผู้ซื้อใช้ร่วมกัน: ฟอร์แมตเงิน/เวลา, ตรวจจำนวนเงินที่บิด, นาฬิกาตามเวลา server, สร้างการ์ดสินค้า
// เงินในหน้าเว็บทั้งหมดเป็น "สตางค์" (จำนวนเต็ม) เหมือนฝั่ง BE ห้ามคำนวณเงินด้วย float
// ข้อความจากผู้ใช้ใส่ลงหน้าด้วย textContent เท่านั้น (ฟังก์ชัน h) ห้ามใช้ innerHTML
// กติกาการบิดฝั่ง FE ต้องตรงกับ decideBid() ใน backend/src/services/auction.service.js (BE ตรวจซ้ำทุกข้อ)
// ฟังก์ชันล้วนอยู่ส่วนบน ส่วน DOM อยู่ด้านล่าง
(function (root) {
  'use strict';

  // ---------- ค่าคงที่ของ UI ----------
  const NEAR_END_MS = 60 * 60 * 1000; // ตัวกรอง "ใกล้จบ (< 1 ชม.)" ตามวาเฟรมข้อ 3.5
  const URGENT_BADGE_MS = 3 * 60 * 60 * 1000; // ป้ายเวลาเป็นสีแดงเมื่อเหลือน้อยกว่านี้ (ตามวาเฟรม) ใช้เพื่อการแสดงผลเท่านั้น

  // ---------- เงิน ----------
  const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

  // บาท (string/number) -> สตางค์ ถ้าไม่ใช่ตัวเลขไม่ติดลบที่ทศนิยมไม่เกิน 2 ตำแหน่ง คืน null
  function parseBahtToSatang(input) {
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) return null;
      input = String(input);
    }
    if (typeof input !== 'string') return null;
    const text = input.trim().replace(/,/g, '');
    if (!DECIMAL_RE.test(text)) return null;
    const [baht, fraction = ''] = text.split('.');
    const satang = Number(baht) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(satang) ? satang : null;
  }

  // สตางค์ -> ข้อความ เช่น 1850000 -> '฿18,500', 155050 -> '฿1,550.50'
  function formatMoney(satang) {
    if (!Number.isSafeInteger(satang) || satang < 0) return '-';
    const baht = Math.floor(satang / 100);
    const frac = satang % 100;
    const grouped = String(baht).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return frac === 0 ? `฿${grouped}` : `฿${grouped}.${String(frac).padStart(2, '0')}`;
  }

  // ---------- เวลา ----------
  function splitRemaining(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }

  // เวลาที่เหลือแบบสั้น เช่น '2 ชม. 15 น.', '1 วัน 3 ชม.', '48 นาที'
  // precise: ต่ำกว่า 1 ชม. แสดงเป็น 'น. วิ' เช่น '1 น. 48 วิ' (ตารางการประมูลของฉัน)
  function formatRemaining(ms, { precise = false } = {}) {
    if (!(ms > 0)) return 'ปิดแล้ว';
    const { days, hours, minutes, seconds } = splitRemaining(ms);
    if (days >= 1) return hours ? `${days} วัน ${hours} ชม.` : `${days} วัน`;
    if (hours >= 1) return `${hours} ชม. ${minutes} น.`;
    if (precise) return minutes ? `${minutes} น. ${seconds} วิ` : `${seconds} วิ`;
    return minutes >= 1 ? `${minutes} นาที` : `${seconds} วิ`;
  }

  // เวลาจาก server อาจมาเป็นตัวเลข ms (server:time ส่ง { now: Date.now() }) หรือข้อความ ISO คืน NaN ถ้าอ่านไม่ได้
  function toMs(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value !== '') return /^\d+$/.test(value) ? Number(value) : Date.parse(value);
    return NaN;
  }

  // นาฬิกาอ้างอิงเวลา server: countdown ห้ามใช้นาฬิกาเครื่องตรงๆ (AGENTS.md)
  // sync(serverNowMs) จด "ส่วนต่าง" ระหว่างเวลา server กับเครื่อง แล้ว now() คืนเวลาที่เทียบเท่า server
  function createClock(getLocalNow = Date.now) {
    let offset = 0;
    return {
      sync(serverNow) {
        const ms = toMs(serverNow);
        if (Number.isFinite(ms)) offset = ms - getLocalNow(); // ค่าเสียไม่ทำให้นาฬิกาพัง
      },
      now() { return getLocalNow() + offset; },
      get offset() { return offset; },
    };
  }

  // ยอดขั้นต่ำถัดไป: เหมือน minNextBid() ใน auction.service.js (ยังไม่มีบิด = ราคาเริ่ม)
  function minNextBid({ currentPrice, startPrice, bidIncrement }) {
    return currentPrice == null ? startPrice : currentPrice + bidIncrement;
  }

  // D-15: ซื้อทันทีได้จนกว่าราคาปัจจุบันจะถึงราคา Buy Now (เหมือน isBuyNowAvailable() ฝั่ง BE)
  function isBuyNowAvailable({ buyNowPrice, currentPrice }) {
    if (buyNowPrice == null) return false;
    return currentPrice == null || currentPrice < buyNowPrice;
  }

  // ---------- ตรวจจำนวนเงินที่บิด (ข้อ 4.1-2, FE validation) ----------
  // mode: 'manual' | 'proxy'  minNext/leaderMax/ผลลัพธ์ เป็นสตางค์
  // BE ตรวจซ้ำทุกข้อ ฟังก์ชันนี้มีไว้ให้ผู้ใช้เห็นข้อผิดพลาดก่อนส่ง
  function validateBidInput({ mode, amountText, minNext, isLeader = false, leaderMax = null }) {
    const satang = parseBahtToSatang(amountText);
    if (satang == null || satang <= 0) {
      return { ok: false, error: 'กรุณากรอกจำนวนเงินเป็นตัวเลขมากกว่า 0 (ทศนิยมไม่เกิน 2 ตำแหน่ง)' };
    }
    // ข้อความด้านล่างตรงกับ AppError ใน auction.service.js
    if (isLeader) {
      if (mode === 'manual') return { ok: false, code: 'ALREADY_LEADING', error: 'คุณเป็นผู้นำอยู่แล้ว ถ้าต้องการเพิ่มราคาให้เพิ่มวงเงิน Proxy แทน' };
      if (leaderMax != null && satang <= leaderMax) {
        return { ok: false, code: 'PROXY_CANNOT_DECREASE', error: `วงเงินใหม่ต้องมากกว่า ${formatMoney(leaderMax)} (ลดหรือยกเลิกวงเงินไม่ได้)` };
      }
      return { ok: true, satang };
    }
    if (satang < minNext) {
      const what = mode === 'proxy' ? 'วงเงิน Proxy ' : 'ราคาที่เสนอ';
      return { ok: false, code: mode === 'proxy' ? 'PROXY_TOO_LOW' : 'BID_TOO_LOW', error: `${what}ต้องไม่ต่ำกว่า ${formatMoney(minNext)}` };
    }
    return { ok: true, satang };
  }

  // ---------- ข้อมูลจาก API (api-spec 0.6) ----------
  // เงินใน JSON เป็นตัวเลขบาททศนิยม 2 ตำแหน่ง -> สตางค์ (ผ่าน toFixed(2) ไม่คูณ float ตรงๆ)
  function moneyToSatang(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? parseBahtToSatang(n.toFixed(2)) : null;
  }
  // สตางค์ -> ตัวเลขบาทสำหรับส่งใน body เช่น { amount: 1600.5 }
  function satangToBaht(satang) {
    return Number(`${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`);
  }

  const CONDITION_NAMES = { new: 'ของใหม่', used_good: 'มือสองสภาพดี', defective: 'มีตำหนิ' };

  // ListingCard จาก API -> รูปแบบที่หน้าเว็บใช้ (เงินเป็นสตางค์ เวลาเป็น ms)
  function normalizeCard(c) {
    return {
      id: c.id,
      title: c.title,
      coverUrl: c.coverUrl || null,
      itemCondition: c.itemCondition,
      conditionName: CONDITION_NAMES[c.itemCondition] || c.itemCondition,
      currentPrice: moneyToSatang(c.currentPrice),
      startPrice: moneyToSatang(c.startPrice),
      displayPrice: moneyToSatang(c.currentPrice != null ? c.currentPrice : c.startPrice), // ยังไม่มีบิด = ราคาเริ่ม
      bidCount: c.bidCount || 0,
      buyNowPrice: moneyToSatang(c.buyNowPrice),
      shippingFee: moneyToSatang(c.shippingFee),
      status: c.status,
      endAt: toMs(c.endAt),
      categoryId: c.categoryId,
    };
  }

  // ---------- URL ที่ปลอดภัยสำหรับรูป ----------
  function safeImageUrl(url) {
    if (typeof url !== 'string') return null;
    return /^(\/|https:\/\/)/.test(url) && !url.startsWith('//') ? url : null;
  }

  const api_ = {
    NEAR_END_MS, URGENT_BADGE_MS,
    parseBahtToSatang, formatMoney, splitRemaining, formatRemaining,
    createClock, toMs, minNextBid, isBuyNowAvailable, validateBidInput, safeImageUrl,
    moneyToSatang, satangToBaht, normalizeCard, CONDITION_NAMES,
  };

  // ---------- ส่วน DOM (รันในเบราว์เซอร์เท่านั้น) ----------
  if (typeof document !== 'undefined') {
    // สร้าง element: h('a', { class: 'x', href: '/', text: 'ข้อความ' }, child1, child2)
    // ข้อความทุกอย่างผ่าน textContent / createTextNode จึงไม่มีช่อง XSS
    function h(tag, props, ...kids) {
      const e = document.createElement(tag);
      if (props) {
        for (const [k, v] of Object.entries(props)) {
          if (v == null || v === false) continue;
          if (k === 'class') e.className = v;
          else if (k === 'text') e.textContent = v;
          else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
          else e.setAttribute(k, v === true ? '' : String(v));
        }
      }
      for (const kid of kids.flat()) {
        if (kid == null || kid === false) continue;
        e.append(typeof kid === 'object' && kid.nodeType ? kid : document.createTextNode(String(kid)));
      }
      return e;
    }

    const clock = createClock();

    // เวลา server ก่อนแสดง countdown (กติกา FE: ห้ามใช้นาฬิกาเครื่อง)
    // ใช้ GET /api/health ที่มีอยู่แล้ว (PM) ซึ่งส่ง serverTime กลับมา หน้ารายละเอียดสินค้า sync ซ้ำจาก Socket server:time
    // ถ้าเรียกไม่ได้ (server ไม่ตอบ) ยังแสดงหน้าได้ แต่เวลาที่เหลืออาจคลาดตามนาฬิกาเครื่อง
    const clockReady = api.get('/health')
      .then((d) => { clock.sync(d.serverTime); })
      .catch(() => {});

    function listingUrl(id) { return `/pages/listing.html?id=${encodeURIComponent(id)}`; }
    function sellerUrl(id) { return `/pages/seller-profile.html?id=${encodeURIComponent(id)}`; }

    // ป้ายเวลาที่เหลือ: ใส่ data-end แล้ว tick() จะอัปเดตทุกวินาที
    function timeBadge(endMs, opts) {
      const badge = h('span', { class: 'au-time' });
      badge.dataset.end = String(endMs);
      if (opts && opts.precise) badge.dataset.precise = '1';
      paintTime(badge);
      return badge;
    }

    function paintTime(badge) {
      const remaining = Number(badge.dataset.end) - clock.now();
      badge.textContent = formatRemaining(remaining, { precise: badge.dataset.precise === '1' });
      badge.classList.toggle('urgent', remaining > 0 && remaining < URGENT_BADGE_MS);
    }

    function tick() { document.querySelectorAll('.au-time[data-end]').forEach(paintTime); }
    let tickTimer = null;
    function startTicker() {
      if (tickTimer) return;
      tickTimer = setInterval(tick, 1000);
    }

    // ---------- Watchlist (api-spec 5.6 / 5.7) ----------
    // คืน true/false ตามสถานะใหม่ ถ้าไม่สำเร็จ throw ApiError (Guest ได้ UNAUTHORIZED)
    async function setWatch(listingId, on) {
      if (on) {
        try {
          await api.post('/watchlist', { listingId: Number(listingId) });
        } catch (e) {
          if (e.code !== 'ALREADY_IN_WATCHLIST') throw e; // อยู่แล้ว = สำเร็จ
        }
        return true;
      }
      await api.del(`/watchlist/${encodeURIComponent(listingId)}`);
      return false;
    }

    // ข้อความแจ้งสั้นๆ มุมล่างของหน้า (ใช้แจ้งผลกดหัวใจ / error ที่ไม่มีที่แสดง)
    function flash(message, kind = 'error') {
      let box = document.getElementById('au-flash');
      if (!box) {
        box = h('div', { id: 'au-flash', class: 'au-flash', role: 'status', 'aria-live': 'polite' });
        document.body.append(box);
      }
      box.replaceChildren(h('div', { class: `alert alert-${kind}`, text: message }));
      clearTimeout(flash.timer);
      flash.timer = setTimeout(() => box.replaceChildren(), 4000);
    }

    // การ์ดสินค้า item: ผลของ normalizeCard()
    // opts.watched = true ถ้าอยู่ใน Watchlist, opts.onWatchChange(item, on) เรียกหลังบันทึกสำเร็จ
    function buildAuctionCard(item, opts = {}) {
      const img = safeImageUrl(item.coverUrl);
      const heart = h('button', {
        type: 'button', class: 'au-heart', 'aria-label': 'เพิ่มใน Watchlist',
        'aria-pressed': opts.watched ? 'true' : 'false', text: opts.watched ? '♥' : '♡',
      });
      heart.addEventListener('click', async () => {
        const want = heart.getAttribute('aria-pressed') !== 'true';
        heart.disabled = true;
        try {
          const on = await setWatch(item.id, want);
          heart.setAttribute('aria-pressed', String(on));
          heart.textContent = on ? '♥' : '♡';
          flash(on ? 'เพิ่มใน Watchlist แล้ว' : 'นำออกจาก Watchlist แล้ว', 'success');
          if (opts.onWatchChange) opts.onWatchChange(item, on);
        } catch (e) {
          flash(e.code === 'UNAUTHORIZED' ? 'กรุณาเข้าสู่ระบบก่อนใช้ Watchlist' : e.message);
        } finally {
          heart.disabled = false;
        }
      });
      const ended = item.status === 'ended';
      return h('article', { class: 'au-card' },
        h('a', { href: listingUrl(item.id), 'aria-label': item.title },
          img ? h('img', { class: 'au-card-img', src: img, alt: '' }) : h('div', { class: 'au-card-img', role: 'img', 'aria-label': 'ยังไม่มีรูปสินค้า' })),
        heart,
        h('div', { class: 'au-card-body' },
          h('a', { class: 'au-card-title', href: listingUrl(item.id), text: item.title }),
          h('div', { class: 'au-label', text: item.currentPrice == null ? 'ราคาเริ่มต้น' : 'ราคาปัจจุบัน' }),
          h('div', { class: 'au-price', text: formatMoney(item.displayPrice) }),
          h('div', { class: 'au-card-foot' },
            h('span', { text: `${item.bidCount} การบิด` }),
            ended ? h('span', { class: 'au-time', text: 'ปิดแล้ว' }) : timeBadge(item.endAt))));
    }

    // แสดงรายการการ์ด ถ้าว่างแสดงข้อความ
    function renderCards(container, items, emptyText, opts) {
      if (!items.length) { container.replaceChildren(h('p', { class: 'muted', text: emptyText })); return; }
      container.replaceChildren(...items.map((it) => buildAuctionCard(it, opts)));
    }

    function showAlert(container, kind, message) {
      container.replaceChildren(h('div', { class: `alert alert-${kind}`, role: kind === 'error' ? 'alert' : 'status', text: message }));
    }

    // ผู้ใช้ปัจจุบันจาก layout.js (window.currentUser + event 'user:ready') null = Guest
    function whenUserReady() {
      if (window.currentUser !== undefined) return Promise.resolve(window.currentUser);
      return new Promise((resolve) => document.addEventListener('user:ready', (e) => resolve(e.detail), { once: true }));
    }

    Object.assign(api_, {
      h, clock, listingUrl, sellerUrl, timeBadge, paintTime, tick, startTicker,
      buildAuctionCard, renderCards, setWatch, flash, showAlert, whenUserReady, clockReady,
    });
  }

  root.Auction = api_;
  if (typeof module !== 'undefined' && module.exports) module.exports = api_;
})(typeof window !== 'undefined' ? window : globalThis);
