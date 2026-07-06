"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOTPEmail = exports.sendUserActionAlert = exports.sendRecoveryKeyUsedAlert = exports.sendLoginAlertEmail = exports.sendEmail = void 0;
// services/emailService.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendEmail = async (options) => {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });
    }
    catch (error) {
        console.error('Email sending failed:', error);
    }
};
exports.sendEmail = sendEmail;
const sendLoginAlertEmail = async (email, name, ipAddress, userAgent, timestamp) => {
    const html = `
    <h2>Security Alert: New Login Detected</h2>
    <p>Dear ${name},</p>
    <p>A new login to your account was detected.</p>
    <h3>Login Details:</h3>
    <ul>
      <li>Time: ${timestamp.toLocaleString('th-TH')}</li>
      <li>IP Address: ${ipAddress}</li>
      <li>Device: ${userAgent}</li>
    </ul>
    <p>If this was not you, please contact IT support immediately.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `;
    await (0, exports.sendEmail)({
        to: email,
        subject: '[SECURITY] New Login to Your AMLO Account',
        html,
    });
};
exports.sendLoginAlertEmail = sendLoginAlertEmail;
const sendRecoveryKeyUsedAlert = async (email, name, ipAddress, userAgent) => {
    const html = `
    <h2>Security Alert: Recovery Key Used</h2>
    <p>Dear ${name},</p>
    <p>A recovery key was used to access your account.</p>
    <h3>Access Details:</h3>
    <ul>
      <li>IP Address: ${ipAddress}</li>
      <li>Device: ${userAgent}</li>
    </ul>
    <p><strong>If you did not perform this action, your account may be compromised.</strong></p>
    <p>Please change your password immediately and check your recovery keys.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `;
    await (0, exports.sendEmail)({
        to: email,
        subject: '[URGENT] Recovery Key Used on Your Account',
        html,
    });
};
exports.sendRecoveryKeyUsedAlert = sendRecoveryKeyUsedAlert;
const sendUserActionAlert = async (adminEmail, adminName, targetEmail, targetName, action, reason, performedBy, ipAddress) => {
    const html = `
    <h2>⚠️ Admin Action Alert: ${action}</h2>
    <p>Dear Supervisor,</p>
    <h3>Action Details:</h3>
    <ul>
      <li><strong>Action:</strong> ${action}</li>
      <li><strong>Performed By:</strong> ${performedBy}</li>
      <li><strong>Target User:</strong> ${targetName} (${targetEmail})</li>
      <li><strong>Reason:</strong> ${reason}</li>
      <li><strong>IP Address:</strong> ${ipAddress}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString('th-TH')}</li>
    </ul>
    <p>If you did not authorize this action, please:</p>
    <ol>
      <li>Use your recovery key to login immediately</li>
      <li>Suspend the compromised supervisor account</li>
      <li>Contact IT Support</li>
    </ol>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `;
    await (0, exports.sendEmail)({
        to: adminEmail,
        subject: `[ACTION REQUIRED] ${action} Performed on Admin Account`,
        html,
    });
};
exports.sendUserActionAlert = sendUserActionAlert;
const sendOTPEmail = async (email, otp, expiresInMinutes) => {
    const html = `
    <h2>Your OTP Verification Code</h2>
    <p>You requested a one-time password (OTP) for AMLO system access.</p>
    <h1 style="font-size: 32px; letter-spacing: 5px;">${otp}</h1>
    <p>This code will expire in ${expiresInMinutes} minutes.</p>
    <p>If you did not request this code, please ignore this email.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `;
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Your AMLO OTP Verification Code',
        html,
    });
};
exports.sendOTPEmail = sendOTPEmail;
//# sourceMappingURL=emailService.js.map