"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/twoFactorRoute.ts
const express_1 = require("express");
const twoFactorController_1 = require("../controllers/twoFactorController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const router = (0, express_1.Router)();
router.post('/setup', auth_1.default, twoFactorController_1.setup2FA);
router.post('/enable', auth_1.default, twoFactorController_1.enable2FA);
router.post('/disable', auth_1.default, twoFactorController_1.disable2FA);
router.get('/recovery-keys', auth_1.default, twoFactorController_1.getRecoveryKeys);
router.post('/recovery-keys/regenerate', auth_1.default, twoFactorController_1.regenerateRecoveryKeys);
router.post('/otp/request', twoFactorController_1.requestEmailOTP);
router.post('/otp/verify', twoFactorController_1.verifyEmailOTPForLogin);
router.post('/verify-login', twoFactorController_1.verify2FALogin);
router.post('/recovery/use', twoFactorController_1.useRecoveryKey);
exports.default = router;
//# sourceMappingURL=twoFactorRoute.js.map