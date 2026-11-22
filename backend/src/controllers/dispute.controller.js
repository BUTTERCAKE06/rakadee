// dispute.controller.js — ข้อพิพาท (api-spec 9.1–9.6) เจ้าของ: QA
const { ok, created, asyncHandler } = require('../utils/response');
const parseId = require('../utils/parseId');
const pagination = require('../utils/pagination');
const service = require('../services/dispute.service');

// 9.1 POST /api/orders/:id/disputes (multipart: type, description, contactInfo, files[0-5])
const openDispute = asyncHandler(async (req, res) => {
  const orderId = parseId(req.params.id, 'id');
  created(res, await service.openDispute(orderId, req.user, req.body || {}, req.files || []));
});

// 9.2 GET /api/disputes/:id
const getDispute = asyncHandler(async (req, res) => {
  ok(res, await service.getDispute(parseId(req.params.id, 'id'), req.user));
});

// 9.7 GET /api/disputes/:id/evidence/:evidenceId — ส่งไฟล์รูปหลักฐาน
const getEvidenceFile = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const evidenceId = parseId(req.params.evidenceId, 'evidenceId');
  res.sendFile(await service.getEvidenceFile(id, evidenceId, req.user));
});

// 9.3 POST /api/disputes/:id/evidence (multipart: files[1-5], note)
const addEvidence = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'id');
  created(res, await service.addEvidence(id, req.user, req.body || {}, req.files || []));
});

// GET /api/disputes — ข้อพิพาทของฉัน (?role=seller|buyer&status=active|closed|...)
const listMine = asyncHandler(async (req, res) => {
  ok(res, await service.listMine(req.user, { ...req.query, ...pagination(req.query) }));
});

// 9.4 GET /api/admin/disputes
const adminList = asyncHandler(async (req, res) => {
  ok(res, await service.adminList({ ...req.query, ...pagination(req.query) }));
});

// 9.5 PATCH /api/admin/disputes/:id/status
const adminUpdateStatus = asyncHandler(async (req, res) => {
  ok(res, await service.adminUpdateStatus(parseId(req.params.id, 'id'), req.user, req.ip, req.body || {}));
});

// 9.6 POST /api/admin/disputes/:id/resolve
const adminResolve = asyncHandler(async (req, res) => {
  ok(res, await service.adminResolve(parseId(req.params.id, 'id'), req.user, req.ip, req.body || {}));
});

module.exports = { openDispute, getDispute, getEvidenceFile, addEvidence, listMine, adminList, adminUpdateStatus, adminResolve };
