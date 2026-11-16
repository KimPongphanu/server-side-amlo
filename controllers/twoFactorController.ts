// controllers/twoFactorController.ts
import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import speakeasy from 'speakeasy'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { generateCsrfToken, setCsrfCookie } from '../middlewares/csrf'
import { checkSessionLimit, createSession } from '../middlewares/session'
import { sendLoginAlertEmail } from '../services/emailService'
import { notifySupervisors } from '../services/securityAlertService'
import {
  disableTOTPForUser,
  enableTOTPForUser,
  generateRecoveryKeys,
  generateTOTPSecret,
  verifyRecoveryKey,
  verifyTOTP,
} from '../services/twoFactorService'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

interface Enable2FABody {
  otpToken: string
}

interface Disable2FABody {
  recoveryKey?: string
  otpToken?: string
}

interface Verify2FABody {
  otpToken: string
  tempToken?: string
}

export const SALT_ROUNDS = 12

export const setup2FA = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    // 🔒 2FA ที่เปิดใช้งานแล้วจะไม่คืน secret เดิมออกไป
    //    ถ้าคืนได้ การเรียก setup ซ้ำ = โคลน authenticator ได้ตลอดไป
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      res.status(409).json({
        success: false,
        message: '2FA เปิดใช้งานอยู่แล้ว หากต้องการตั้งค่าใหม่ให้ปิดใช้งานก่อน',
      })
      return
    }

    // ✅ Use existing secret if already saved (partially enrolled), otherwise generate new one
    let secret = user.twoFactorSecret
    let otpauthUrl = ''

    if (!secret) {
      const generated = generateTOTPSecret(user.email)
      secret = generated.secret
      otpauthUrl = generated.otpauthUrl

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret },
      })
    } else {
      // Rebuild otpauthUrl from existing secret (same secret every time)
      otpauthUrl = speakeasy.otpauthURL({
        secret: secret,
        label: `AMLO System (${user.email})`,
        encoding: 'base32',
      })
    }

    res.status(200).json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        qrCodeDataUrl: null,
      },
      message:
        'Scan QR code with Google Authenticator or Microsoft Authenticator',
    })
  },
)

export const enable2FA = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { otpToken } = req.body as Enable2FABody
    const { ipAddress, userAgent } = getClientMetadata(req)

    if (!otpToken) {
      res.status(400).json({ message: 'OTP token is required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    if (!user.twoFactorSecret) {
      res.status(400).json({ message: 'Please setup 2FA first' })
      return
    }

    const isValid = verifyTOTP(otpToken, user.twoFactorSecret)

    if (!isValid) {
      res.status(400).json({ message: 'Invalid OTP token' })
      return
    }

    await enableTOTPForUser(user.id, user.twoFactorSecret)

    const recoveryKeys = await generateRecoveryKeys(user.id)

    await logAudit(
      req,
      'ENABLE_2FA_SUCCESS',
      `User enabled 2FA (Authenticator) for account: ${user.email}`,
      user.id,
    )

    // 🌟 แจ้ง Supervisor ทันทีเมื่อมีการผูก Authenticator — นี่คือจุดที่บัญชีถูกยึดได้
    await notifySupervisors(
      'ADMIN_ENROLLED_2FA',
      `บัญชี ${user.firstname} ${user.lastname} (${user.email}) เปิดใช้งาน 2FA (Authenticator) แล้ว`,
      `IP: ${ipAddress} | Device: ${userAgent}`,
    )

    res.status(200).json({
      success: true,
      message: '2FA enabled successfully. Save your recovery keys.',
      data: {
        recoveryKeys,
      },
    })
  },
)

export const disable2FA = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { recoveryKey, otpToken } = req.body as Disable2FABody
    const { ipAddress, userAgent } = getClientMetadata(req)

    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    let isVerified = false

    if (otpToken && user.twoFactorSecret) {
      isVerified = verifyTOTP(otpToken, user.twoFactorSecret)
    }

    if (!isVerified && recoveryKey) {
      isVerified = await verifyRecoveryKey(user.id, recoveryKey, req)
    }

    if (!isVerified) {
      res.status(400).json({ message: 'Invalid OTP token or recovery key' })
      return
    }

    await disableTOTPForUser(user.id)

    await logAudit(
      req,
      'DISABLE_2FA_SUCCESS',
      `User disabled 2FA for account: ${user.email}`,
      user.id,
    )

    res.status(200).json({
      success: true,
      message: '2FA disabled successfully',
    })
  },
)

export const getRecoveryKeys = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    const recoveryKeys = await prisma.recoveryKey.findMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    res.status(200).json({
      success: true,
      data: {
        count: recoveryKeys.length,
        available: recoveryKeys.length > 0,
      },
    })
  },
)

export const regenerateRecoveryKeys = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    if (!user.twoFactorEnabled) {
      res
        .status(400)
        .json({ message: '2FA must be enabled to generate recovery keys' })
      return
    }

    const newRecoveryKeys = await generateRecoveryKeys(user.id)

    await logAudit(
      req,
      'REGENERATE_RECOVERY_KEYS',
      `User regenerated recovery keys for account: ${user.email}`,
      user.id,
    )

    res.status(200).json({
      success: true,
      message: 'New recovery keys generated. Save them immediately.',
      data: {
        recoveryKeys: newRecoveryKeys,
      },
    })
  },
)

export const verify2FALogin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { otpToken } = req.body as Verify2FABody

    if (!otpToken) {
      res.status(400).json({ message: 'OTP token is required' })
      return
    }

    const tempToken = req.cookies.temp_2fa_token
    if (!tempToken) {
      res
        .status(400)
        .json({ message: '2FA session expired. Please login again.' })
      return
    }

    let decoded: { userId: number }
    try {
      decoded = require('jsonwebtoken').verify(
        tempToken,
        process.env.JWT_SECRET,
      ) as {
        userId: number
      }
    } catch (error) {
      res.status(401).json({ message: '2FA session expired or invalid. Please login again.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    let isValid = false

    if (user.twoFactorMethod === 'AUTHENTICATOR' && user.twoFactorSecret) {
      isValid = verifyTOTP(otpToken, user.twoFactorSecret)
    }

    if (!isValid) {
      res.status(400).json({ message: 'Invalid 2FA code' })
      return
    }

    const { ipAddress, userAgent } = getClientMetadata(req)

    const secret = process.env.JWT_SECRET
    const finalToken = require('jsonwebtoken').sign(
      {
        uuid: user.uuid,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
      },
      secret,
      { expiresIn: user.role === 'SUPERVISOR' ? '4h' : '12h' },
    )

    // 🌟 Enforce session limits (Supervisor = 1 session, Admin = 3)
    const { allowed, maxSessions } = await checkSessionLimit(user.id, user.role)
    if (!allowed) {
      res.status(429).json({
        message: `บัญชีนี้มีการใช้งานถึงจำนวน session สูงสุด (${maxSessions}) แล้ว กรุณาออกจากระบบเครื่องอื่นก่อน`,
      })
      return
    }

    // 🌟 สร้าง session record (ใช้ตรวจ inactivity / revoke / force logout ให้ได้จริง)
    await createSession(
      user.id,
      finalToken,
      ipAddress,
      userAgent,
      user.role === 'SUPERVISOR' ? 4 : 12,
    )

    res.cookie('token', finalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:
        user.role === 'SUPERVISOR' ? 4 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000,
    })

    res.clearCookie('temp_2fa_token')

    // 🌟 rotate CSRF token ใหม่พร้อม session จริง (double-submit pattern)
    const csrfToken = setCsrfCookie(res, generateCsrfToken())

    // 🌟 อีเมลแจ้งเตือนเป็น best-effort — ส่งเบื้องหลัง ไม่ block response
    void sendLoginAlertEmail(
      user.email,
      `${user.firstname} ${user.lastname}`,
      ipAddress,
      userAgent,
      new Date(),
    ).catch((err) => console.error('Login alert email failed:', err))

    await logAudit(
      req,
      'LOGIN_SUCCESS',
      'User logged in successfully with 2FA',
      user.id,
    )

    res.status(200).json({
      success: true,
      message: 'Login successful',
      csrfToken,
      user: {
        uuid: user.uuid,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        forcePasswordReset: user.forcePasswordReset,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
      },
    })
  },
)

export const useRecoveryKey = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, recoveryKey } = req.body

    if (!email || !recoveryKey) {
      res.status(400).json({ message: 'Email and recovery key are required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    const isValid = await verifyRecoveryKey(user.id, recoveryKey, req)

    if (!isValid) {
      await logAudit(
        req,
        'RECOVERY_KEY_FAILED',
        `Invalid recovery key used for ${email}`,
        user.id,
      )
      res.status(400).json({ message: 'Invalid or expired recovery key' })
      return
    }

    const tempToken = require('jsonwebtoken').sign(
      { userId: user.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    )

    // Disable 2FA so user can login again with new password (without 2FA)
    await disableTOTPForUser(user.id)

    await logAudit(
      req,
      'RECOVERY_KEY_USED',
      `Recovery key used for ${email}. 2FA has been disabled.`,
      user.id,
    )

    res.status(200).json({
      success: true,
      message:
        'Recovery key verified. 2FA has been disabled. You can now reset your password.',
      data: { resetToken: tempToken },
    })
  },
)
