"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireSupervisor = exports.restrictTo = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const session_1 = require("./session");
const hashToken = (token) => {
    return require('crypto').createHash('sha256').update(token).digest('hex');
};
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            res.status(401).json({ message: 'Access Denied: No Token Provided' });
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ message: 'JWT Secret configuration missing' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // 🌟 ตรวจสอบ JWT Blacklist (token ที่ถูก logout แล้ว)
        const isBlacklisted = await prisma_1.default.jwtBlacklist.findUnique({
            where: { token },
        });
        if (isBlacklisted) {
            res.clearCookie('token');
            res.status(401).json({ message: 'Token ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่' });
            return;
        }
        // 🌟 เช็คสถานะผู้ใช้จาก Database (ban / forcePasswordReset)
        const user = await prisma_1.default.user.findUnique({
            where: { uuid: decoded.uuid },
            select: { id: true, status: true, forcePasswordReset: true },
        });
        if (!user) {
            res.clearCookie('token');
            res.status(401).json({ message: 'User account not found' });
            return;
        }
        if (user.status === 'Inactive') {
            res.clearCookie('token');
            res.status(401).json({ message: 'บัญชีนี้ถูกระงับการใช้งาน' });
            return;
        }
        req.user = { ...decoded, id: user.id };
        await (0, session_1.validateAndUpdateSession)(req, res, next);
    }
    catch (error) {
        res.clearCookie('token');
        res.status(401).json({ message: 'Invalid Token' });
    }
};
exports.authMiddleware = authMiddleware;
const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource',
            });
            return;
        }
        next();
    };
};
exports.restrictTo = restrictTo;
exports.requireSupervisor = (0, exports.restrictTo)('SUPERVISOR');
exports.requireAdmin = (0, exports.restrictTo)('ADMIN', 'SUPERVISOR');
// Default export for backward compatibility
const authMiddlewareExport = exports.authMiddleware;
exports.default = authMiddlewareExport;
//# sourceMappingURL=auth.js.map