// services/twoFactorService.ts
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import prisma from '../lib/prisma'

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

export const generateRecoveryKeys = async (
  userId: number,
): Promise<string[]> => {
  const recoveryKeyStrings: string[] = []

  await prisma.recoveryKey.deleteMany({ where: { userId } })

  for (let i = 0; i < 8; i++) {
    const key = crypto.randomBytes(8).toString('hex').toUpperCase()
    const formatted = `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`
    recoveryKeyStrings.push(formatted)

    // Use bcrypt with 8 rounds to prevent CPU exhaustion
    const hashedKey = await bcrypt.hash(key, 8)
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
