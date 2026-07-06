"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredSessions = exports.revokeOtherSessions = exports.revokeAllUserSessions = exports.checkSessionLimit = exports.validateAndUpdateSession = exports.createSession = void 0;
// middlewares/session.ts
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const SUPERVISOR_MAX_SESSIONS = 1;
const ADMIN_MAX_SESSIONS = 3;
const SESSION_INACTIVITY_MS = 30 * 60 * 1000;
const SUPERVISOR_INACTIVITY_MS = 15 * 60 * 1000;
const hashToken = (token) => {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
};
const createSession = async (userId, token, ipAddress, userAgent, expiresInHours) => {
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    await prisma_1.default.session.create({
        data: {
            userId,
            tokenHash,
            ipAddress,
            userAgent,
            expiresAt,
            lastActiveAt: new Date(),
        },
    });
};
exports.createSession = createSession;
const validateAndUpdateSession = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            next();
            return;
        }
        const tokenHash = hashToken(token);
        const session = await prisma_1.default.session.findFirst({
            where: {
                tokenHash,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });
        if (!session) {
            next();
            return;
        }
        const inactivityMs = session.user.role === 'SUPERVISOR'
            ? SUPERVISOR_INACTIVITY_MS
            : SESSION_INACTIVITY_MS;
        const lastActive = new Date(session.lastActiveAt);
        const now = new Date();
        if (now.getTime() - lastActive.getTime() > inactivityMs) {
            await prisma_1.default.session.delete({ where: { id: session.id } });
            res.clearCookie('token');
            res.status(401).json({ message: 'Session expired due to inactivity' });
            return;
        }
        await prisma_1.default.session.update({
            where: { id: session.id },
            data: { lastActiveAt: now },
        });
        req.session = { id: session.id, userId: session.userId };
        next();
    }
    catch (error) {
        console.error('Session validation error:', error);
        next();
    }
};
exports.validateAndUpdateSession = validateAndUpdateSession;
const checkSessionLimit = async (userId, role) => {
    const activeSessions = await prisma_1.default.session.count({
        where: {
            userId,
            expiresAt: { gt: new Date() },
        },
    });
    const maxSessions = role === 'SUPERVISOR' ? SUPERVISOR_MAX_SESSIONS : ADMIN_MAX_SESSIONS;
    const allowed = activeSessions < maxSessions;
    return { allowed, currentSessions: activeSessions, maxSessions };
};
exports.checkSessionLimit = checkSessionLimit;
const revokeAllUserSessions = async (userId) => {
    await prisma_1.default.session.deleteMany({
        where: { userId },
    });
};
exports.revokeAllUserSessions = revokeAllUserSessions;
const revokeOtherSessions = async (userId, currentSessionId) => {
    await prisma_1.default.session.deleteMany({
        where: {
            userId,
            id: { not: currentSessionId },
        },
    });
};
exports.revokeOtherSessions = revokeOtherSessions;
const cleanupExpiredSessions = async () => {
    await prisma_1.default.session.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });
};
exports.cleanupExpiredSessions = cleanupExpiredSessions;
//# sourceMappingURL=session.js.map