// admin.user.controller.js — จัดการผู้ใช้และบทลงโทษ (api-spec 10.1–10.7) เจ้าของ: QA
const { ok, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const pagination = require('../utils/pagination');
const service = require('../services/admin.user.service');

const listUsers = asyncHandler(async (req, res) => {                     // 10.1
  ok(res, await service.listUsers({ ...req.query, ...pagination(req.query) }));
});
const getUser = asyncHandler(async (req, res) => {                       // 10.2
  ok(res, await service.getUser(parseId(req.params.id, 'id')));
});
const changeStatus = asyncHandler(async (req, res) => {                  // 10.3
  ok(res, await service.changeStatus(parseId(req.params.id, 'id'), req.user, req.ip, req.body || {}));
});
const banUser = asyncHandler(async (req, res) => {                       // 10.4
  ok(res, await service.banUser(parseId(req.params.id, 'id'), req.user, req.ip, req.body || {}));
});
const revokeBlacklist = asyncHandler(async (req, res) => {               // 10.5
  ok(res, await service.revokeBlacklist(parseId(req.params.id, 'id'), req.user, req.ip));
});
const listFlags = asyncHandler(async (req, res) => {                     // 10.6
  ok(res, await service.listFlags({ reviewed: req.query.reviewed || 'false', ...pagination(req.query) }));
});
const reviewFlag = asyncHandler(async (req, res) => {                    // 10.7
  ok(res, await service.reviewFlag(parseId(req.params.id, 'id'), req.user, req.ip));
});

module.exports = { listUsers, getUser, changeStatus, banUser, revokeBlacklist, listFlags, reviewFlag };
