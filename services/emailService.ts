// services/emailService.ts
import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
  } catch (error) {
    console.error('Email sending failed:', error)
  }
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
  `

  await sendEmail({
    to: email,
    subject: '[SECURITY] New Login to Your AMLO Account',
    html,
  })
}

export const sendRecoveryKeyUsedAlert = async (
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> => {
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
  `

  await sendEmail({
    to: email,
    subject: '[URGENT] Recovery Key Used on Your Account',
    html,
  })
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
  `

  await sendEmail({
    to: adminEmail,
    subject: `[ACTION REQUIRED] ${action} Performed on Admin Account`,
    html,
  })
}

export const sendOTPEmail = async (
  email: string,
  otp: string,
  expiresInMinutes: number,
): Promise<void> => {
  const html = `
    <h2>Your OTP Verification Code</h2>
    <p>You requested a one-time password (OTP) for AMLO system access.</p>
    <h1 style="font-size: 32px; letter-spacing: 5px;">${otp}</h1>
    <p>This code will expire in ${expiresInMinutes} minutes.</p>
    <p>If you did not request this code, please ignore this email.</p>
    <hr>
    <p><small>Anti-Money Laundering Office (AMLO)</small></p>
  `

  await sendEmail({
    to: email,
    subject: 'Your AMLO OTP Verification Code',
    html,
  })
}
