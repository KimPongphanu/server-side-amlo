"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bannerController_1 = require("../controllers/bannerController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload"));
const auditLogger_1 = require("../utils/auditLogger");
const router = express_1.default.Router();
// Audit log middleware for authenticated routes
const audit = (action, getDetails) => async (req, _res, next) => {
    const userId = req.user?.id ?? null;
    await (0, auditLogger_1.logAudit)(req, action, getDetails(req), userId);
    next();
};
// GET /api/banners — สาธารณะ (default: only isShow=true, ใช้ ?all=true สำหรับ admin)
router.get('/', bannerController_1.getAllBanners);
// POST /api/banners — ต้องล็อกอิน + rate limit + audit
router.post('/', auth_1.default, rateLimiter_1.uploadLimiter, upload_1.default.single('image'), audit('CREATE_BANNER', (req) => `เพิ่ม Banner${req.body.title ? `: ${req.body.title}` : ''}`), bannerController_1.createBanner);
// PUT /api/banners/reorder — ต้องล็อกอิน + audit
router.put('/reorder', auth_1.default, audit('REORDER_BANNERS', (req) => `จัดลำดับ Banner ใหม่: ${JSON.stringify(req.body.orderedIds)}`), bannerController_1.reorderBanners);
// PUT /api/banners/:id — อัปเดต title และ link_url (ต้องล็อกอิน) + audit
router.put('/:id', auth_1.default, audit('UPDATE_BANNER', (req) => `แก้ไข Banner #${req.params.id}${req.body.title ? ` title="${req.body.title}"` : ''}${req.body.link_url ? ` link="${req.body.link_url}"` : ''}`), bannerController_1.updateBanner);
// PATCH /api/banners/:id/toggle — toggle isShow (ต้องล็อกอิน) + audit
router.patch('/:id/toggle', auth_1.default, audit('TOGGLE_BANNER', (req) => `Toggle แสดง/ซ่อน Banner #${req.params.id}`), bannerController_1.toggleBannerVisibility);
// DELETE /api/banners/:id — ต้องล็อกอิน + audit
router.delete('/:id', auth_1.default, audit('DELETE_BANNER', (req) => `ลบ Banner #${req.params.id}`), bannerController_1.deleteBanner);
exports.default = router;
//# sourceMappingURL=bannerRoute.js.map