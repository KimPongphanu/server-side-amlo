// services/emailService.ts
import nodemailer from 'nodemailer'
import { escapeHtml } from '../utils/escapeHtml'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

const smtpPort = parseInt(process.env.SMTP_PORT || '587')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  // Port 465 = implicit TLS, port 587 = STARTTLS
  // requireTLS บังคับ upgrade เป็น TLS เสมอ — ป้องกัน credential ไหลผ่านช่องทางไม่เข้ารหัส
  secure: smtpPort === 465,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  // ปล่อย error ออกไปให้ caller จัดการ — ห้ามกลืน error เงียบ ๆ
  // (ผู้เรียกควร try/catch และแจ้งผู้ใช้อย่างตรงไปตรงมาเมื่อส่งอีเมลไม่สำเร็จ)
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}

export const sendLoginAlertEmail = async (
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
  timestamp: Date,
): Promise<void> => {
  const html = `
    <h2>Security Alert: New Login Detected</h2>
    <p>Dear ${escapeHtml(name)},</p>
    <p>A new login to your account was detected.</p>
    <h3>Login Details:</h3>
    <ul>
      <li>Time: ${timestamp.toLocaleString('th-TH')}</li>
      <li>IP Address: ${escapeHtml(ipAddress)}</li>
      <li>Device: ${escapeHtml(userAgent)}</li>
    </ul>
    <p>If this was not you, please contact IT support immediately.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `

  try {
    await sendEmail({
      to: email,
      subject: '[SECURITY] New Login to Your AMLO Account',
      html,
    })
  } catch (error) {
    // Alert email เป็น best-effort — ห้ามทำให้ flow หลักล้มเหลว
    console.error('Login alert email sending failed:', error)
  }
}

export const sendRecoveryKeyUsedAlert = async (
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> => {
  const html = `
    <h2>Security Alert: Recovery Key Used</h2>
    <p>Dear ${escapeHtml(name)},</p>
    <p>A recovery key was used to access your account.</p>
    <h3>Access Details:</h3>
    <ul>
      <li>IP Address: ${escapeHtml(ipAddress)}</li>
      <li>Device: ${escapeHtml(userAgent)}</li>
    </ul>
    <p><strong>If you did not perform this action, your account may be compromised.</strong></p>
    <p>Please change your password immediately and check your recovery keys.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `

  try {
    await sendEmail({
      to: email,
      subject: '[URGENT] Recovery Key Used on Your Account',
      html,
    })
  } catch (error) {
    // Alert email เป็น best-effort — ห้ามทำให้ flow หลักล้มเหลว
    console.error('Recovery key alert email sending failed:', error)
  }
}

export const sendUserActionAlert = async (
  adminEmail: string,
  adminName: string,
  targetEmail: string,
  targetName: string,
  action: string,
  reason: string,
  performedBy: string,
  ipAddress: string,
): Promise<void> => {
  const html = `
    <h2>⚠️ Admin Action Alert: ${escapeHtml(action)}</h2>
    <p>Dear Supervisor,</p>
    <h3>Action Details:</h3>
    <ul>
      <li><strong>Action:</strong> ${escapeHtml(action)}</li>
      <li><strong>Performed By:</strong> ${escapeHtml(performedBy)}</li>
      <li><strong>Target User:</strong> ${escapeHtml(targetName)} (${escapeHtml(targetEmail)})</li>
      <li><strong>Reason:</strong> ${escapeHtml(reason)}</li>
      <li><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</li>
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
  `

  try {
    await sendEmail({
      to: adminEmail,
      subject: `[ACTION REQUIRED] ${action} Performed on Admin Account`,
      html,
    })
  } catch (error) {
    // Alert email เป็น best-effort — ห้ามทำให้ flow หลักล้มเหลว
    console.error('User action alert email sending failed:', error)
  }
}

