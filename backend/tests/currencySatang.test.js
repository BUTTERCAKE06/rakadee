// Unit Test: ทดสอบความแม่นยำของการคำนวณเงินในระดับสตางค์ (SA Module)
// ตามข้อกำหนด AGENTS.md: เงินเก็บเป็น DECIMAL ห้ามคำนวณด้วย float ให้แปลงเป็นสตางค์ก่อนคำนวณ
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function toSatang(value) {
  const s = typeof value === 'number' ? value.toFixed(2) : String(value || '0').trim();
  const [baht, frac = ''] = s.split('.');
  return Number(baht) * 100 + Number(frac.padEnd(2, '0'));
}
const toDecimal = (satang) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;

describe('การคำนวณเงินในหน่วยสตางค์ (Satang Currency Arithmetic)', () => {
  it('แปลง float เป็นสตางค์ได้อย่างแม่นยำ ไม่สูญเสียทศนิยม', () => {
    assert.equal(toSatang(0.1 + 0.2), 30);
    assert.equal(toDecimal(30), '0.30');
    assert.equal(toSatang(19.99), 1999);
    assert.equal(toSatang('123456.78'), 12345678);
  });

  it('การบวกและลบเงินสตางค์ไม่มีปัญหา 0.00000000000000004 จาก float', () => {
    // ปัญหาคลาสสิกของ float: 100.10 + 200.20 = 300.30000000000007
    const s1 = toSatang('100.10');
    const s2 = toSatang('200.20');
    const sumSatang = s1 + s2;
    assert.equal(sumSatang, 30030);
    assert.equal(toDecimal(sumSatang), '300.30');

    // ลบเงิน
    const diffSatang = sumSatang - toSatang('50.05');
    assert.equal(diffSatang, 25025);
    assert.equal(toDecimal(diffSatang), '250.25');
  });

  it('จัดรูปแบบสตางค์เป็น Decimal มีศูนย์นำหน้าในเศษทศนิยมเสมอ', () => {
    assert.equal(toDecimal(5), '0.05');
    assert.equal(toDecimal(9), '0.09');
    assert.equal(toDecimal(10), '0.10');
    assert.equal(toDecimal(100), '1.00');
    assert.equal(toDecimal(105), '1.05');
  });
});
