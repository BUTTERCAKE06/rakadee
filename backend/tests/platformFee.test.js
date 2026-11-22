// Unit Test: สูตรคำนวณค่าธรรมเนียมแพลตฟอร์ม (Requirement 5.4, D-10)
// สูตร: min(max(ราคาปิด × 5%, 20), ราคาปิด) คิดจากราคาปิดประมูลเท่านั้น ไม่รวมค่าส่ง
// npm --prefix backend test

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePlatformFee } = require('../src/services/escrow');

describe('สูตรคำนวณค่าธรรมเนียมแพลตฟอร์ม (Platform Fee Formula)', () => {
  it('กรณีราคาปกติทั่วไป (5% > 20 บาท): คิด 5% ของราคาปิด', () => {
    // 1,000 บาท: 5% = 50 บาท
    assert.equal(calculatePlatformFee(1000), 50.00);

    // 4,500 บาท: 5% = 225 บาท
    assert.equal(calculatePlatformFee(4500), 225.00);

    // 10,000 บาท: 5% = 500 บาท
    assert.equal(calculatePlatformFee(10000), 500.00);
  });

  it('กรณีชนเกณฑ์ขั้นต่ำ 20 บาท (5% < 20 บาท): คิดขั้นต่ำ 20 บาท', () => {
    // 100 บาท: 5% = 5 บาท -> คิดขั้นต่ำ 20 บาท
    assert.equal(calculatePlatformFee(100), 20.00);

    // 200 บาท: 5% = 10 บาท -> คิดขั้นต่ำ 20 บาท
    assert.equal(calculatePlatformFee(200), 20.00);

    // 399 บาท: 5% = 19.95 บาท -> คิดขั้นต่ำ 20 บาท
    assert.equal(calculatePlatformFee(399), 20.00);
  });

  it('กรณีจุดตัดขั้นต่ำพอดี (ราคา 400 บาท): 5% = 20 บาท พอดี', () => {
    // 400 บาท: 5% = 20.00 บาท
    assert.equal(calculatePlatformFee(400), 20.00);

    // 401 บาท: 5% = 20.05 บาท (เกินขั้นต่ำแล้ว คิดตาม 5%)
    assert.equal(calculatePlatformFee(401), 20.05);
  });

  it('กรณีราคาต่ำกว่า 20 บาท (ห้ามเก็บเกินราคาปิดประมูล): คิดไม่เกินราคาปิด', () => {
    // 15 บาท: max(0.75, 20) = 20 -> min(20, 15) = 15 บาท
    assert.equal(calculatePlatformFee(15), 15.00);

    // 1 บาท: max(0.05, 20) = 20 -> min(20, 1) = 1 บาท
    assert.equal(calculatePlatformFee(1), 1.00);

    // 20 บาท: max(1, 20) = 20 -> min(20, 20) = 20 บาท
    assert.equal(calculatePlatformFee(20), 20.00);
  });

  it('กรณีราคามีทศนิยม/เศษสตางค์: คำนวณเป็นหน่วยสตางค์อย่างแม่นยำ', () => {
    // 500.50 บาท: 5% = 25.025 บาท -> ปัดเป็น 25.03 บาท
    assert.equal(calculatePlatformFee(500.50), 25.03);

    // รองรับ input ทั้งชนิด number และ string
    assert.equal(calculatePlatformFee('4500.00'), 225.00);
  });
});

