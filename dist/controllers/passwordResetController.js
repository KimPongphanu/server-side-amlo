"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = void 0;
// controllers/passwordResetController.ts
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailService_1 = require("../services/emailService");
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
exports.resetPassword = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, otp, totp, resetToken, newPassword } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!email || !newPassword) {
        res.status(400).json({ message: 'Email and new password are required' });
        return;
    }
    if ((!otp || otp === '') &&
        (!totp || totp === '') &&
        (!resetToken || resetToken === '')) {
        res.status(400).json({ message: 'OTP, TOTP, or reset token is required' });
        return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        res.status(400).json({
            message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข',
        });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    // Verify TOTP (2FA Authenticator) if provided
    let verifiedTotp = false;
    if (totp) {
        if (!user.twoFactorSecret) {
            res
                .status(400)
                .json({ message: 'ผู้ใช้ยังไม่ได้ตั้งค่า 2FA Authenticator' });
            return;
        }
        verifiedTotp = speakeasy_1.default.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: totp,
            window: 1,
        });
        if (!verifiedTotp) {
            res.status(400).json({ message: 'รหัส 2FA ไม่ถูกต้อง' });
            return;
        }
    }
    // Verify OTP if provided (save id for later, don't mark used yet)
    let verifiedOtpId = null;
    if (otp) {
        const emailOtps = await prisma_1.default.email_otps.findMany({
            where: {
                email: email.toLowerCase(),
                used: false,
                expiresAt: { gt: new Date() },
            },
        });
        let isOtpValid = false;
        for (const record of emailOtps) {
            if (await bcryptjs_1.default.compare(otp, record.otp)) {
                verifiedOtpId = record.id;
                isOtpValid = true;
                break;
            }
        }
        if (!isOtpValid) {
            res.status(400).json({ message: 'Invalid or expired OTP' });
            return;
        }
    }
    // Verify reset token from recovery key flow
    if (resetToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET);
            if (decoded.userId !== user.id) {
                res.status(400).json({ message: 'Reset token does not match user' });
                return;
            }
        }
        catch {
            res.status(400).json({ message: 'Invalid or expired reset token' });
            return;
        }
    }
    // Check password history (last 3 passwords)
    const history = await prisma_1.default.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
    });
    for (const record of history) {
        const isMatch = await bcryptjs_1.default.compare(newPassword, record.passwordHash);
        if (isMatch) {
            res.status(400).json({
                message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านก่อนหน้า 3 ครั้งล่าสุด',
            });
            return;
        }
    }
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
    });
    await prisma_1.default.passwordHistory.create({
        data: {
            userId: user.id,
            passwordHash: hashedPassword,
        },
    });
    // 🌟 Mark OTP as used ONLY after all validations pass and password is saved
    if (verifiedOtpId) {
        await prisma_1.default.email_otps.update({
            where: { id: verifiedOtpId },
            data: { used: true },
        });
    }
    await (0, auditLogger_1.logAudit)(req, 'PASSWORD_RESET_SUCCESS', `Password reset successfully for user: ${user.email}${verifiedTotp ? ' (via 2FA)' : otp ? ' (via email OTP)' : resetToken ? ' (via recovery key)' : ''}`, user.id);
    const html = `
      <h2>Password Reset Successful</h2>
      <p>Dear ${user.firstname} ${user.lastname},</p>
      <p>Your password has been successfully reset.</p>
      <h3>Details:</h3>
      <ul>
        <li>Time: ${new Date().toLocaleString('th-TH')}</li>
        <li>IP Address: ${ipAddress}</li>
        <li>Device: ${userAgent}</li>
      </ul>
      <p>If you did not perform this action, please contact IT support immediately.</p>
      <hr>
      <p><small>Anti-Money Laundering Office (AMLO)</small></p>
    `;
    await (0, emailService_1.sendEmail)({
        to: user.email,
        subject: '[SECURITY] Your Password Has Been Reset',
        html,
    });
    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully',
    });
});
//# sourceMappingURL=passwordResetController.js.map