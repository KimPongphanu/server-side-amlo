"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentRateLimiter = exports.apiLimiter = exports.uploadLimiter = exports.registerLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Custom key generator: use userId if logged in, fallback to IP
const keyGenerator = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip;
    return req.user?.uuid || ip || 'unknown';
};
// ── Login Limiter ────────────────────────────────────────────
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 30 * 60 * 1000,
    max: 10,
    keyGenerator,
    skipSuccessfulRequests: true,
    validate: false,
    message: {
        message: 'คุณลองเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่อีกครั้งในอีก 30 นาที',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[RATE-LIMIT] login blocked for key: ${keyGenerator(req)}`);
        res.status(429).json({
            message: 'คุณลองเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่อีกครั้งในอีก 30 นาที',
        });
    },
});
// ── Register Limiter ─────────────────────────────────────────
exports.registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator,
    validate: false,
    message: {
        message: 'คุณทำการสมัครสมาชิกถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 1 ชั่วโมง',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// ── Upload Limiter ───────────────────────────────────────────
exports.uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator,
    validate: false,
    message: {
        message: 'คุณอัปโหลดไฟล์ถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// ── Public API Limiter (general) ─────────────────────────────
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 400,
    keyGenerator,
    validate: false,
    message: { message: 'ระบบตรวจพบการเรียกใช้งานที่ถี่เกินไป' },
    standardHeaders: true,
    legacyHeaders: false,
});
// ── Comment Limiter ──────────────────────────────────────────
exports.commentRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 30 * 60 * 1000,
    max: 10,
    keyGenerator,
    validate: false,
    message: {
        success: false,
        message: 'คุณส่งความคิดเห็นบ่อยเกินไป กรุณารอ 30 นาที แล้วลองใหม่อีกครั้ง',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
//# sourceMappingURL=rateLimiter.js.map