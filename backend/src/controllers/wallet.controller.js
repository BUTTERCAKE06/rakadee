// Wallet Controller — ข้อ 7 ใน docs/api-spec/api-spec.md
const { ok } = require('../utils/response');
const walletService = require('../services/wallet');

// 7.1 GET /api/wallet
async function getWallet(req, res) {
  const data = await walletService.getWalletSummary(req.user.id);
  ok(res, data);
}

// 7.2 GET /api/wallet/transactions
async function getTransactions(req, res) {
  const { page, limit } = req.query;
  const data = await walletService.getTransactions(req.user.id, page, limit);
  ok(res, data);
}

module.exports = {
  getWallet,
  getTransactions,
};

