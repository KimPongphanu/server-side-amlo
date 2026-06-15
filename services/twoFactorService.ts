// services/twoFactorService.ts
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import prisma from '../lib/prisma'
import { sendOTPEmail } from './emailService'

export const generateTOTPSecret = (email: string) => {
  const secret = speakeasy.generateSecret({
    name: `AMLO System (${email})`,
    length: 20,
  })
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  }
}

export const verifyTOTP = (token: string, secret: string): boolean => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1,
  })
}

export const generateEmailOTP = async (email: string): Promise<void> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.email_otps.create({
    data: {
      email: email.toLowerCase(),
      otp,
      expiresAt,
      used: false,
    },
  })

  // 🔴 LOG OTP TO CONSOLE FOR DEVELOPMENT (SMTP may not be configured)
  const separator = '='.repeat(60)
  console.log(separator)
  console.log(`🔐 [OTP] Email: ${email}`)
  console.log(`🔐 [OTP] Code:  ${otp}`)
  console.log(`🔐 [OTP] Expires at: ${expiresAt.toISOString()}`)
  console.log(`🔐 [OTP] Valid for: 5 minutes`)
  console.log(separator)

  try {
    await sendOTPEmail(email, otp, 5)
    console.log(`[OTP] Email sent successfully to ${email}`)
  } catch (err) {
    console.log(`[OTP] Email sending failed (SMTP not configured).`)
    console.log(`[OTP] Use the OTP code from console above: ${otp}`)
  }
}

export const verifyEmailOTP = async (
  email: string,
  otp: string,
): Promise<boolean> => {
  const record = await prisma.email_otps.findFirst({
    where: {
      email: email.toLowerCase(),
      otp,
      used: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (!record) return false

  await prisma.email_otps.update({
    where: { id: record.id },
    data: { used: true },
  })

  return true
}

export const generateRecoveryKeys = async (
  userId: number,
): Promise<string[]> => {
  const recoveryKeyStrings: string[] = []

  for (let i = 0; i < 8; i++) {
    const key = crypto.randomBytes(8).toString('hex').toUpperCase()
    const formatted = `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`
    recoveryKeyStrings.push(formatted)

    // Use bcrypt for consistency with seed.ts (which also uses bcrypt)
    const hashedKey = await bcrypt.hash(key, 12)
    await prisma.recoveryKey.create({
      data: {
        userId,
        keyHash: hashedKey,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  return recoveryKeyStrings
}

export const verifyRecoveryKey = async (
  userId: number,
  recoveryKey: string,
  req: any,
): Promise<boolean> => {
  const rawKey = recoveryKey.replace(/-/g, '').toUpperCase()

  // Fetch all valid (unused, not expired) recovery keys
  const records = await prisma.recoveryKey.findMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  // All keys are now bcrypt-hashed (both seed and runtime) for consistency
  for (const record of records) {
    const isMatch = await bcrypt
      .compare(rawKey, record.keyHash)
      .catch(() => false)
    if (isMatch) {
      await prisma.recoveryKey.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      })
      return true
    }
  }

  return false
}

export const enableTOTPForUser = async (
  userId: number,
  secret: string,
): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorMethod: 'AUTHENTICATOR',
      twoFactorSecret: secret,
    },
  })
}

export const disableTOTPForUser = async (userId: number): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorMethod: 'NONE',
      twoFactorSecret: null,
    },
  })
}
