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
const footerSettingController_1 = require("../controllers/footerSettingController");
const auth_1 = __importStar(require("../middlewares/auth"));
const auditLogger_1 = require("../utils/auditLogger");
const router = express_1.default.Router();
// GET /api/settings — สาธารณะ
router.get('/', footerSettingController_1.getAllSettings);
// PUT /api/settings — admin เท่านั้น + audit
router.put('/', auth_1.default, auth_1.requireSupervisor, async (req, res, next) => {
    const userId = req.user?.id ?? null;
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_SITE_SETTINGS', 'อัปเดตการตั้งค่าเว็บไซต์ (Footer, นโยบาย ฯลฯ)', userId);
    next();
}, footerSettingController_1.updateSettings);
exports.default = router;
//# sourceMappingURL=footerSettingRoute.js.map