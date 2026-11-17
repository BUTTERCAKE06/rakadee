// ข้อความแจ้งเตือนของแต่ละ event (api-spec หัวข้อ 11 ตาราง Event, requirement ข้อ 7 การแจ้งเตือน)
// group ใช้กับ notification_settings: auction | finance | shipping (null = ปิดไม่ได้)
// data ที่ใช้ได้: listingId, listingTitle, orderId, amount (หรือ currentPrice / price / finalPrice), reason, result, forSeller,
//                endAt, extendCount, trackingNumber, carrier, proxyStopped, link
const time = require('../config/time');

const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const item = (d) => d.listingTitle || (d.listingId ? `สินค้า #${d.listingId}` : 'สินค้า');
const price = (d) => d.amount ?? d.currentPrice ?? d.price ?? d.finalPrice;
const hours = (ms) => Math.round(ms / 3600000);
const minutes = (ms) => Math.round(ms / 60000);
const order = (d) => (d.orderId ? `#ORD-${d.orderId}` : '');

const listingLink = (d) => (d.listingId ? `/pages/listing.html?id=${d.listingId}` : null);
const orderLink = (d) => (d.orderId ? `/pages/orders.html?id=${d.orderId}` : null);

const TEMPLATES = {
  ACCOUNT_VERIFY: {
    group: null, web: false, email: true,
    title: () => 'ยืนยันอีเมลของคุณ',
    message: (d) => `กดลิงก์เพื่อยืนยันอีเมล: ${d.link || ''}`,
    link: () => null,
  },
  PASSWORD_RESET: {
    group: null, web: false, email: true,
    title: () => 'ตั้งรหัสผ่านใหม่',
    message: (d) => `กดลิงก์เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ ${minutes(time.passwordResetExpireMs)} นาที ครั้งเดียว): ${d.link || ''}`,
    link: () => null,
  },
  LISTING_APPROVED: {
    group: 'auction',
    title: () => 'สินค้าได้รับการอนุมัติ',
    message: (d) => `${item(d)} เริ่มประมูลแล้ว`,
    link: listingLink,
  },
  LISTING_REJECTED: {
    group: 'auction',
    title: () => 'สินค้าไม่ผ่านการอนุมัติ',
    message: (d) => `${item(d)}${d.reason ? ` เหตุผล: ${d.reason}` : ''}`,
    link: (d) => (d.listingId ? `/pages/seller/listing-form.html?id=${d.listingId}` : null),
  },
  OUTBID: {
    group: 'auction',
    title: () => 'คุณถูกบิดแซง',
    message: (d) => `${item(d)} ถูกเสนอราคา ${baht(price(d))}${d.proxyStopped ? ' — Proxy ของคุณหยุดทำงานเพราะราคาเกินวงเงิน เพิ่มวงเงินหรือบิดเองได้' : ''}`,
    link: listingLink,
  },
  AUCTION_EXTENDED: {
    group: 'auction',
    title: () => 'ต่อเวลาอัตโนมัติ',
    message: (d) => `${item(d)} ต่อเวลาอีก ${minutes(time.autoExtendMs)} นาที${d.extendCount ? ` (ครั้งที่ ${d.extendCount}/${time.autoExtendMaxCount})` : ''}`,
    link: listingLink,
  },
  AUCTION_ENDING_SOON: {
    group: 'auction',
    title: () => 'ใกล้หมดเวลาประมูล',
    message: (d) => `${item(d)} ใกล้ปิดประมูลแล้ว`,
    link: listingLink,
  },
  // ผู้ขายใช้ event เดียวกัน ส่ง forSeller: true (api-spec 11 ตาราง Event)
  AUCTION_WON: {
    group: 'auction',
    title: (d) => (d.forSeller ? 'สินค้าของคุณขายได้แล้ว' : 'คุณชนะการประมูล!'),
    message: (d) => (d.forSeller
      ? `${item(d)} ปิดที่ราคา ${baht(price(d))} รอผู้ซื้อชำระเงินภายใน ${hours(time.paymentDueMs)} ชม.`
      : `${item(d)} ราคา ${baht(price(d))} กรุณาชำระภายใน ${hours(time.paymentDueMs)} ชม.`),
    link: (d) => (d.forSeller ? listingLink(d) : orderLink(d) || listingLink(d)),
  },
  AUCTION_LOST: {
    group: 'auction',
    title: (d) => (d.forSeller ? 'ปิดประมูลโดยไม่มีผู้ชนะ' : 'การประมูลสิ้นสุด'),
    message: (d) => {
      if (d.forSeller) {
        return d.result === 'below_reserve'
          ? `${item(d)} ราคาสูงสุด ${baht(price(d))} ไม่ถึงราคาขั้นต่ำที่ตั้งไว้`
          : `${item(d)} ไม่มีผู้บิด`;
      }
      return d.result === 'below_reserve'
        ? `${item(d)} ปิดประมูลแล้ว ราคาไม่ถึงราคาขั้นต่ำของผู้ขาย จึงไม่มีผู้ชนะ`
        : `${item(d)} ปิดประมูลแล้ว คุณไม่ใช่ผู้ชนะ`;
    },
    link: listingLink,
  },
  PAYMENT_DUE_SOON: {
    group: 'finance',
    title: () => 'ใกล้ถึงกำหนดชำระเงิน',
    message: (d) => `คำสั่งซื้อ ${order(d)} ${item(d)} เหลือเวลาชำระอีก 24 ชม.`,
    link: orderLink,
  },
  PAYMENT_SUCCESS: {
    group: 'finance',
    title: () => 'ชำระเงินสำเร็จ',
    message: (d) => `คำสั่งซื้อ ${order(d)} ชำระสำเร็จ เงินอยู่ใน Escrow จนกว่าคุณจะยืนยันรับสินค้า`,
    link: orderLink,
  },
  FUNDS_RELEASED: {
    group: 'finance',
    title: () => 'ได้รับเงินจากการขาย',
    message: (d) => `คำสั่งซื้อ ${order(d)} โอนเงิน ${baht(d.amount)} เข้า Mock Wallet แล้ว (หักค่าธรรมเนียมแล้ว)`,
    link: () => '/pages/wallet.html',
  },
  REFUNDED: {
    group: 'finance',
    title: () => 'ได้รับเงินคืน',
    message: (d) => `${baht(d.amount)} เข้า Mock Wallet${d.orderId ? ` (${order(d)})` : ''}`,
    link: () => '/pages/wallet.html',
  },
  SHIPPED: {
    group: 'shipping',
    title: () => 'ผู้ขายส่งของแล้ว',
    message: (d) => `คำสั่งซื้อ ${order(d)}${d.trackingNumber ? ` เลขพัสดุ ${d.trackingNumber}` : ''}${d.carrier ? ` (${d.carrier})` : ''}`,
    link: orderLink,
  },
  DISPUTE_OPENED: {
    group: 'shipping',
    title: () => 'มีการเปิดข้อพิพาท',
    message: (d) => `คำสั่งซื้อ ${order(d)} ถูกแจ้งปัญหา กรุณาส่งหลักฐานของคุณ`,
    link: (d) => (d.disputeId ? `/pages/disputes.html?id=${d.disputeId}` : orderLink(d)),
  },
};

module.exports = { TEMPLATES };
