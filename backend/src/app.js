const path = require('path');
const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// API
app.use('/api', routes);

// ไฟล์ที่อัปโหลด (รูปสินค้า รูปโปรไฟล์ สลิปโอนเงิน)
app.use('/uploads/products', express.static(path.join(config.upload.dir, 'products')));
app.use('/uploads/avatars', express.static(path.join(config.upload.dir, 'avatars')));
app.use('/uploads/slips', express.static(path.join(config.upload.dir, 'slips')));

// Front-end (HTML/CSS/JS) เสิร์ฟจาก server เดียวกัน
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
