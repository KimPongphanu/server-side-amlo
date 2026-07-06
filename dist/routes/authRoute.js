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
Object.defineProperty(exports, "__esModule", { value: true });
// routes/authRoute.ts
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const checkEmailController_1 = require("../controllers/checkEmailController");
const emergencyController_1 = require("../controllers/emergencyController");
const forceResetController_1 = require("../controllers/forceResetController");
const passwordResetController_1 = require("../controllers/passwordResetController");
const auth_1 = __importStar(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @ROUTE   POST /api/auth/register
 * @DESC    Register a new admin user (Supervisor only)
 */
router.post('/register', auth_1.default, auth_1.requireSupervisor, rateLimiter_1.registerLimiter, authController_1.registerUser);
/**
 * @ROUTE   POST /api/auth/login
 * @DESC    Authenticate user and issue JWT
 */
router.post('/login', rateLimiter_1.loginLimiter, authController_1.loginUser);
/**
 * @ROUTE   POST /api/auth/logout
 * @DESC    Clear cookie and blacklist the current JWT
 */
router.post('/logout', auth_1.default, authController_1.logoutUser);
/**
 * @ROUTE   GET /api/auth/me
 * @DESC    Get current user profile
 */
router.get('/me', auth_1.default, authController_1.getMe);
/**
 * @ROUTE   PUT /api/auth/me
 * @DESC    Update current user profile (firstname, lastname)
 * @ACCESS  Authenticated
 */
router.put('/me', auth_1.default, authController_1.updateMyProfile);
/**
 * @ROUTE   GET /api/auth/users
 * @DESC    Get all users (Supervisor only)
 */
router.get('/users', auth_1.default, auth_1.requireSupervisor, authController_1.getUsers);
/**
 * @ROUTE   PUT /api/auth/users/:uuid/ban
 * @DESC    Ban a user with 3-step confirmation (Supervisor only)
 */
router.put('/users/:uuid/ban', auth_1.default, auth_1.requireSupervisor, authController_1.banUser);
/**
 * @ROUTE   PUT /api/auth/users/:uuid/unban
 * @DESC    Unban a user with 3-step confirmation (Supervisor only)
 */
router.put('/users/:uuid/unban', auth_1.default, auth_1.requireSupervisor, authController_1.unbanUser);
/**
 * @ROUTE   DELETE /api/auth/users/:uuid
 * @DESC    Delete a user with 3-step confirmation (Supervisor only)
 */
router.delete('/users/:uuid', auth_1.default, auth_1.requireSupervisor, authController_1.deleteUser);
/**
 * @ROUTE   POST /api/auth/heartbeat
 * @DESC    อัปเดตสถานะออนไลน์ (ยิงทุก 5 นาที)
 */
router.post('/heartbeat', auth_1.default, authController_1.heartbeat);
/**
 * @ROUTE   POST /api/auth/check-email
 * @DESC    Check if email exists and return user role
 */
router.post('/check-email', rateLimiter_1.loginLimiter, checkEmailController_1.checkEmail);
/**
 * @ROUTE   POST /api/auth/reset-password
 * @DESC    Reset password using OTP or reset token
 */
router.post('/reset-password', passwordResetController_1.resetPassword);
/**
 * @ROUTE   POST /api/auth/emergency-action
 * @DESC    Supervisor uses recovery key to BAN/DELETE/FORCE_RESET another compromised Supervisor
 * @ACCESS  Supervisor only
 */
router.post('/emergency-action', auth_1.default, auth_1.requireSupervisor, emergencyController_1.emergencyAction);
/**
 * @ROUTE   POST /api/auth/users/:uuid/otp-action
 * @DESC    Supervisor uses own OTP to unban another Supervisor
 * @ACCESS  Supervisor only
 */
router.post('/users/:uuid/otp-action', auth_1.default, auth_1.requireSupervisor, authController_1.supervisorOTPAction);
/**
 * @ROUTE   POST /api/auth/users/:uuid/force-logout
 * @DESC    Supervisor uses own OTP to force logout another user
 * @ACCESS  Supervisor only
 */
router.post('/users/:uuid/force-logout', auth_1.default, auth_1.requireSupervisor, authController_1.forceLogoutUser);
// ──────────────────────────────────────────────────────
// SUPERVISOR FORCE RESET PASSWORD ROUTES
// ──────────────────────────────────────────────────────
/**
 * @ROUTE   POST /api/auth/users/:uuid/force-reset
 * @DESC    Supervisor forces a user to reset password on next login
 * @ACCESS  Supervisor only
 */
router.post('/users/:uuid/force-reset', auth_1.default, auth_1.requireSupervisor, forceResetController_1.forceResetUserPassword);
/**
 * @ROUTE   POST /api/auth/force-reset/send-otp
 * @DESC    Send OTP to user email for force reset (called on mount)
 * @ACCESS  Authenticated
 */
router.post('/force-reset/send-otp', auth_1.default, forceResetController_1.sendForceResetOTP);
/**
 * @ROUTE   POST /api/auth/force-reset/resend-otp
 * @DESC    Resend OTP (invalidates old one)
 * @ACCESS  Authenticated
 */
router.post('/force-reset/resend-otp', auth_1.default, forceResetController_1.resendForceResetOTP);
/**
 * @ROUTE   POST /api/auth/force-reset/verify
 * @DESC    Verify OTP + set new password, clears forcePasswordReset flag
 * @ACCESS  Authenticated
 */
router.post('/force-reset/verify', auth_1.default, forceResetController_1.verifyForceResetOTP);
exports.default = router;
//# sourceMappingURL=authRoute.js.map