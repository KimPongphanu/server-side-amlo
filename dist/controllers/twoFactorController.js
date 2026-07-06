"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRecoveryKey = exports.verify2FALogin = exports.verifyEmailOTPForLogin = exports.requestEmailOTP = exports.regenerateRecoveryKeys = exports.getRecoveryKeys = exports.disable2FA = exports.enable2FA = exports.setup2FA = exports.SALT_ROUNDS = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailService_1 = require("../services/emailService");
const twoFactorService_1 = require("../services/twoFactorService");
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
exports.SALT_ROUNDS = 10;
exports.setup2FA = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    if (user.role !== 'SUPERVISOR') {
        res.status(403).json({
            message: '2FA with Authenticator is only for Supervisor accounts',
        });
        return;
    }
    // ✅ Use existing secret if already saved, otherwise generate new one
    let secret = user.twoFactorSecret;
    let otpauthUrl = '';
    if (!secret) {
        const generated = (0, twoFactorService_1.generateTOTPSecret)(user.email);
        secret = generated.secret;
        otpauthUrl = generated.otpauthUrl;
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: secret },
        });
    }
    else {
        // Rebuild otpauthUrl from existing secret (same secret every time)
        otpauthUrl = speakeasy_1.default.otpauthURL({
            secret: secret,
            label: `AMLO System (${user.email})`,
            encoding: 'base32',
        });
    }
    res.status(200).json({
        success: true,
        data: {
            otpauthUrl,
            qrCodeDataUrl: null,
        },
        message: 'Scan QR code with Google Authenticator or Microsoft Authenticator',
    });
});
exports.enable2FA = (0, express_async_handler_1.default)(async (req, res) => {
    const { otpToken } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!otpToken) {
        res.status(400).json({ message: 'OTP token is required' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    if (!user.twoFactorSecret) {
        res.status(400).json({ message: 'Please setup 2FA first' });
        return;
    }
    const isValid = (0, twoFactorService_1.verifyTOTP)(otpToken, user.twoFactorSecret);
    if (!isValid) {
        res.status(400).json({ message: 'Invalid OTP token' });
        return;
    }
    await (0, twoFactorService_1.enableTOTPForUser)(user.id, user.twoFactorSecret);
    const recoveryKeys = await (0, twoFactorService_1.generateRecoveryKeys)(user.id);
    await (0, auditLogger_1.logAudit)(req, 'ENABLE_2FA_SUCCESS', `User enabled 2FA (Authenticator) for account: ${user.email}`, user.id);
    res.status(200).json({
        success: true,
        message: '2FA enabled successfully. Save your recovery keys.',
        data: {
            recoveryKeys,
        },
    });
});
exports.disable2FA = (0, express_async_handler_1.default)(async (req, res) => {
    const { recoveryKey, otpToken } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    let isVerified = false;
    if (otpToken && user.twoFactorSecret) {
        isVerified = (0, twoFactorService_1.verifyTOTP)(otpToken, user.twoFactorSecret);
    }
    if (!isVerified && recoveryKey) {
        isVerified = await (0, twoFactorService_1.verifyRecoveryKey)(user.id, recoveryKey, req);
    }
    if (!isVerified) {
        res.status(400).json({ message: 'Invalid OTP token or recovery key' });
        return;
    }
    await (0, twoFactorService_1.disableTOTPForUser)(user.id);
    await (0, auditLogger_1.logAudit)(req, 'DISABLE_2FA_SUCCESS', `User disabled 2FA for account: ${user.email}`, user.id);
    res.status(200).json({
        success: true,
        message: '2FA disabled successfully',
    });
});
exports.getRecoveryKeys = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    const recoveryKeys = await prisma_1.default.recoveryKey.findMany({
        where: {
            userId: user.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
    res.status(200).json({
        success: true,
        data: {
            count: recoveryKeys.length,
            available: recoveryKeys.length > 0,
        },
    });
});
exports.regenerateRecoveryKeys = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    if (!user.twoFactorEnabled) {
        res
            .status(400)
            .json({ message: '2FA must be enabled to generate recovery keys' });
        return;
    }
    const newRecoveryKeys = await (0, twoFactorService_1.generateRecoveryKeys)(user.id);
    await (0, auditLogger_1.logAudit)(req, 'REGENERATE_RECOVERY_KEYS', `User regenerated recovery keys for account: ${user.email}`, user.id);
    res.status(200).json({
        success: true,
        message: 'New recovery keys generated. Save them immediately.',
        data: {
            recoveryKeys: newRecoveryKeys,
        },
    });
});
exports.requestEmailOTP = (0, express_async_handler_1.default)(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ message: 'Email is required' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (!user) {
        res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
        return;
    }
    await (0, twoFactorService_1.generateEmailOTP)(email.toLowerCase());
    res.status(200).json({
        success: true,
        message: 'OTP sent to your email. Valid for 5 minutes.',
    });
});
exports.verifyEmailOTPForLogin = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        res.status(400).json({ message: 'Email and OTP are required' });
        return;
    }
    const isValid = await (0, twoFactorService_1.verifyEmailOTP)(email.toLowerCase(), otp);
    if (!isValid) {
        res.status(400).json({ message: 'Invalid or expired OTP' });
        return;
    }
    res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
    });
});
exports.verify2FALogin = (0, express_async_handler_1.default)(async (req, res) => {
    const { otpToken } = req.body;
    if (!otpToken) {
        res.status(400).json({ message: 'OTP token is required' });
        return;
    }
    const tempToken = req.cookies.temp_2fa_token;
    if (!tempToken) {
        res
            .status(400)
            .json({ message: '2FA session expired. Please login again.' });
        return;
    }
    let decoded;
    try {
        decoded = require('jsonwebtoken').verify(tempToken, process.env.JWT_SECRET);
    }
    catch (error) {
        res.status(401).json({ message: '2FA session expired or invalid. Please login again.' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id: decoded.userId },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    let isValid = false;
    if (user.twoFactorMethod === 'AUTHENTICATOR' && user.twoFactorSecret) {
        isValid = (0, twoFactorService_1.verifyTOTP)(otpToken, user.twoFactorSecret);
    }
    else if (user.twoFactorMethod === 'EMAIL_OTP') {
        isValid = await (0, twoFactorService_1.verifyEmailOTP)(user.email, otpToken);
    }
    if (!isValid) {
        res.status(400).json({ message: 'Invalid 2FA code' });
        return;
    }
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const secret = process.env.JWT_SECRET;
    const finalToken = require('jsonwebtoken').sign({
        uuid: user.uuid,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
    }, secret, { expiresIn: user.role === 'SUPERVISOR' ? '4h' : '12h' });
    res.cookie('token', finalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: user.role === 'SUPERVISOR' ? 4 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000,
    });
    res.clearCookie('temp_2fa_token');
    await (0, emailService_1.sendLoginAlertEmail)(user.email, `${user.firstname} ${user.lastname}`, ipAddress, userAgent, new Date());
    await (0, auditLogger_1.logAudit)(req, 'LOGIN_SUCCESS', 'User logged in successfully with 2FA', user.id);
    res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
            uuid: user.uuid,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            role: user.role,
        },
    });
});
exports.useRecoveryKey = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, recoveryKey } = req.body;
    if (!email || !recoveryKey) {
        res.status(400).json({ message: 'Email and recovery key are required' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (!user || user.role !== 'SUPERVISOR') {
        res.status(404).json({ message: 'Supervisor account not found' });
        return;
    }
    const isValid = await (0, twoFactorService_1.verifyRecoveryKey)(user.id, recoveryKey, req);
    if (!isValid) {
        await (0, auditLogger_1.logAudit)(req, 'RECOVERY_KEY_FAILED', `Invalid recovery key used for ${email}`, user.id);
        res.status(400).json({ message: 'Invalid or expired recovery key' });
        return;
    }
    const tempToken = require('jsonwebtoken').sign({ userId: user.id, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    // Disable 2FA so user can login again with new password (without 2FA)
    await (0, twoFactorService_1.disableTOTPForUser)(user.id);
    await (0, auditLogger_1.logAudit)(req, 'RECOVERY_KEY_USED', `Recovery key used for ${email}. 2FA has been disabled.`, user.id);
    res.status(200).json({
        success: true,
        message: 'Recovery key verified. 2FA has been disabled. You can now reset your password.',
        data: { resetToken: tempToken },
    });
});
//# sourceMappingURL=twoFactorController.js.map