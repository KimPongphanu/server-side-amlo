"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableTOTPForUser = exports.enableTOTPForUser = exports.verifyRecoveryKey = exports.generateRecoveryKeys = exports.verifyEmailOTP = exports.generateEmailOTP = exports.verifyTOTP = exports.generateTOTPSecret = void 0;
// services/twoFactorService.ts
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailService_1 = require("./emailService");
const generateTOTPSecret = (email) => {
    const secret = speakeasy_1.default.generateSecret({
        name: `AMLO System (${email})`,
        length: 20,
    });
    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url || '',
    };
};
exports.generateTOTPSecret = generateTOTPSecret;
const verifyTOTP = (token, secret) => {
    return speakeasy_1.default.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1,
    });
};
exports.verifyTOTP = verifyTOTP;
const generateEmailOTP = async (email) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const hashedOtp = await bcryptjs_1.default.hash(otp, 12);
    await prisma_1.default.email_otps.create({
        data: {
            email: email.toLowerCase(),
            otp: hashedOtp,
            expiresAt,
            used: false,
        },
    });
    // 🔴 LOG OTP TO CONSOLE FOR DEVELOPMENT ONLY (ห้าม log ใน Production)
    if (process.env.NODE_ENV !== 'production') {
        const separator = '='.repeat(60);
        console.log(separator);
        console.log(`🔐 [OTP] Email: ${email}`);
        console.log(`🔐 [OTP] Code:  ${otp}`);
        console.log(`🔐 [OTP] Expires at: ${expiresAt.toISOString()}`);
        console.log(`🔐 [OTP] Valid for: 5 minutes`);
        console.log(separator);
    }
    try {
        await (0, emailService_1.sendOTPEmail)(email, otp, 5);
        console.log(`[OTP] Email sent successfully`);
    }
    catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[OTP] Email sending failed (SMTP not configured).`);
            console.log(`[OTP] Use the OTP code from console above: ${otp}`);
        }
        else {
            console.error(`[OTP] Email sending failed`);
        }
    }
};
exports.generateEmailOTP = generateEmailOTP;
const verifyEmailOTP = async (email, otp) => {
    const records = await prisma_1.default.email_otps.findMany({
        where: {
            email: email.toLowerCase(),
            used: false,
            expiresAt: { gt: new Date() },
        },
    });
    for (const record of records) {
        const isMatch = await bcryptjs_1.default.compare(otp, record.otp);
        if (isMatch) {
            await prisma_1.default.email_otps.update({
                where: { id: record.id },
                data: { used: true },
            });
            return true;
        }
    }
    return false;
};
exports.verifyEmailOTP = verifyEmailOTP;
const generateRecoveryKeys = async (userId) => {
    const recoveryKeyStrings = [];
    await prisma_1.default.recoveryKey.deleteMany({ where: { userId } });
    for (let i = 0; i < 8; i++) {
        const key = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
        const formatted = `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
        recoveryKeyStrings.push(formatted);
        // Use bcrypt with 8 rounds to prevent CPU exhaustion
        const hashedKey = await bcryptjs_1.default.hash(key, 8);
        await prisma_1.default.recoveryKey.create({
            data: {
                userId,
                keyHash: hashedKey,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
    }
    return recoveryKeyStrings;
};
exports.generateRecoveryKeys = generateRecoveryKeys;
const verifyRecoveryKey = async (userId, recoveryKey, req) => {
    const rawKey = recoveryKey.replace(/-/g, '').toUpperCase();
    // Fetch all valid (unused, not expired) recovery keys
    const records = await prisma_1.default.recoveryKey.findMany({
        where: {
            userId,
            usedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
    // All keys are now bcrypt-hashed (both seed and runtime) for consistency
    for (const record of records) {
        const isMatch = await bcryptjs_1.default
            .compare(rawKey, record.keyHash)
            .catch(() => false);
        if (isMatch) {
            await prisma_1.default.recoveryKey.update({
                where: { id: record.id },
                data: { usedAt: new Date() },
            });
            return true;
        }
    }
    return false;
};
exports.verifyRecoveryKey = verifyRecoveryKey;
const enableTOTPForUser = async (userId, secret) => {
    await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            twoFactorEnabled: true,
            twoFactorMethod: 'AUTHENTICATOR',
            twoFactorSecret: secret,
        },
    });
};
exports.enableTOTPForUser = enableTOTPForUser;
const disableTOTPForUser = async (userId) => {
    await prisma_1.default.user.update({
        where: { id: userId },
        data: {
            twoFactorEnabled: false,
            twoFactorMethod: 'NONE',
            twoFactorSecret: null,
        },
    });
};
exports.disableTOTPForUser = disableTOTPForUser;
//# sourceMappingURL=twoFactorService.js.map