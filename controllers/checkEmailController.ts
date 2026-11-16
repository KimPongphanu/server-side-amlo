// controllers/checkEmailController.ts
import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'

interface CheckEmailBody {
  email: string
}

export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as CheckEmailBody

  if (!email || !email.trim()) {
    res.status(400).json({ message: 'Email is required' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      role: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
    },
  })

  if (!user) {
    res.status(200).json({
      found: false,
      message: 'ไม่พบอีเมลนี้ในระบบ',
    })
    return
  }

  // 🌟 2FA (Authenticator) เป็นวิธีเดียวที่ใช้ได้แล้ว — ไม่มี email OTP แล้ว
  const requires2FA =
    user.twoFactorEnabled && user.twoFactorMethod === 'AUTHENTICATOR'

  res.status(200).json({
    found: true,
    role: user.role, // 'ADMIN' | 'SUPERVISOR'
    requires2FA,
  })
})
