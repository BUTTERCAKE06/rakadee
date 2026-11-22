// ส่งอีเมลผ่าน SMTP (requirement 1.2 SMTP Email Service)
// ไม่ตั้ง SMTP_HOST ใน .env = ไม่ส่งจริง แสดงเนื้อหาอีเมลใน console แทน (ใช้ตอนพัฒนา/ทดสอบ)
const nodemailer = require('nodemailer');
const config = require('../config');

let transport = null;

function getTransport() {
  if (transport) return transport;
  const { host, port, user, pass } = config.smtp;
  transport = host
    ? nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined })
    : null;
  return transport;
}

async function send(to, subject, text, linkUrl) {
  const link = linkUrl ? `${config.appUrl}${linkUrl}` : null;
  const body = link ? `${text}\n\n${link}` : text;
  const t = getTransport();
  if (!t) {
    console.log(`[mail:console] to=${to} subject="${subject}"\n${body}`);
    return;
  }
  await t.sendMail({ from: config.smtp.from, to, subject: `[Rakadee] ${subject}`, text: body });
}

module.exports = { send };
