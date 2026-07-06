"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const splashPopupController_1 = require("../controllers/splashPopupController");
const auth_1 = __importStar(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload"));
const auditLogger_1 = require("../utils/auditLogger");
const router = express_1.default.Router();
// GET /api/splash-popups/active — สาธารณะ (ต้องมาก่อน /:id)
router.get('/active', splashPopupController_1.getActivePopup);
// GET /api/splash-popups — admin
router.get('/', auth_1.default, auth_1.requireSupervisor, splashPopupController_1.getAllPopups);
// POST /api/splash-popups — admin + upload
router.post('/', auth_1.default, auth_1.requireSupervisor, rateLimiter_1.uploadLimiter, upload_1.default.single('image'), async (req, res, next) => {
    const userId = req.user?.id ?? null;
    await (0, auditLogger_1.logAudit)(req, 'CREATE_SPLASH_POPUP', `สร้าง Popup${req.body.title ? `: ${req.body.title}` : ''}`, userId);
    next();
}, splashPopupController_1.createPopup);
// PUT /api/splash-popups/:id — admin
router.put('/:id', auth_1.default, auth_1.requireSupervisor, async (req, res, next) => {
    const userId = req.user?.id ?? null;
    const isActive = req.body.isActive;
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_SPLASH_POPUP', `อัปเดต Popup #${req.params.id}${isActive !== undefined ? ` isActive=${isActive}` : ''}`, userId);
    next();
}, splashPopupController_1.updatePopup);
// DELETE /api/splash-popups/:id — admin
router.delete('/:id', auth_1.default, auth_1.requireSupervisor, async (req, res, next) => {
    const userId = req.user?.id ?? null;
    await (0, auditLogger_1.logAudit)(req, 'DELETE_SPLASH_POPUP', `ลบ Popup #${req.params.id}`, userId);
    next();
}, splashPopupController_1.deletePopup);
exports.default = router;
//# sourceMappingURL=splashPopupRoute.js.map