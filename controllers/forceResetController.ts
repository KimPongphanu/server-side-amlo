// controllers/forceResetController.ts
import bcrypt from 'bcryptjs'
import { Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { revokeAllUserSessions } from '../middlewares/session'
import { notifySupervisors } from '../services/securityAlertService'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

/**
 * @ROUTE   POST /api/auth/users/:uuid/force-reset
 * @DESC    Supervisor forces a user to re-enroll 2FA and set a new password on next login
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 *
 * 🚫 ไม่มีอีเมล OTP ในขั้นตอนนี้แล้ว — ลำดับบังคับของผู้ใช้คือ
 *    1) login ด้วยรหัสผ่านที่ Supervisor ให้ไว้
 *    2) 2FA (ถ้ายังไม่มี secret ต้อง enroll ก่อน / ถ้ามีแล้วต้องยืนยัน)
 *    3) ตั้งรหัสผ่านใหม่
 *    ลำดับนี้ถูกบังคับที่ middlewares/auth.ts ไม่ใช่แค่ฝั่งหน้าเว็บ
 */
export const forceResetUserPassword = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params

    const user = await prisma.user.findUnique({ where: { uuid } })
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    if (user.role === 'SUPERVISOR') {
      res
        .status(403)
        .json({ message: 'Cannot force reset a supervisor account' })
      return
    }

    // 🌟 ตั้ง flag + เวลาที่ออก "รหัสผ่านชั่วคราว" เพื่อบังคับ TTL
    await prisma.user.update({
      where: { id: user.id },
      data: {
        forcePasswordReset: true,
        tempPasswordIssuedAt: new Date(),
        passwordChangedAt: null,
      },
    })

    // Revoke all user sessions so they must log in again
    await revokeAllUserSessions(user.id)

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'FORCE_RESET_PASSWORD',
      `Supervisor forced password reset for user: ${user.email} (User ID: ${user.id})`,
      supervisor?.id,
    )

    res.status(200).json({
      success: true,
      message: `Force password reset triggered for ${user.email}`,
    })
  },
)

/**
 * @ROUTE   POST /api/auth/force-reset/verify
 * @DESC    Set a new password for an account in the forced-reset flow.
 *          No OTP is required: the caller already proved 2FA possession when
 *          signing in, and this route is only reachable after enrollment
 *          (enforced by middlewares/auth.ts).
 * @ACCESS  Authenticated user with forcePasswordReset + 2FA enrolled
 */
export const verifyForceReset = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { newPassword } = req.body
    const { ipAddress, userAgent } = getClientMetadata(req)

    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    if (!user.forcePasswordReset) {
      res.status(400).json({ message: 'No force password reset required' })
      return
    }

    // 🌟 ขั้นที่ 2 ของ bootstrap ทำได้เฉพาะเมื่อผ่านการ enroll 2FA แล้วเท่านั้น
    if (!user.twoFactorEnabled) {
      res.status(428).json({
        success: false,
        code: 'ENROLL_2FA_REQUIRED',
        message: 'ต้องเปิดใช้งาน 2FA ก่อนจึงจะเปลี่ยนรหัสผ่านได้',
      })
      return
    }

    if (!newPassword) {
      res.status(400).json({ message: 'New password is required' })
      return
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      res.status(400).json({
        message:
          'รหัสผ่านต้องมีอย่างน้อย 8 ตัว ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข',
      })
      return
    }

    // Check password history (last 3 passwords)
    const history = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    for (const record of history) {
      const isMatch = await bcrypt.compare(newPassword, record.passwordHash)
      if (isMatch) {
        res.status(400).json({
          message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านก่อนหน้า 3 ครั้งล่าสุด',
        })
        return
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        forcePasswordReset: false,
        passwordChangedAt: new Date(),
        tempPasswordIssuedAt: null,
      },
    })

    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash: hashedPassword,
      },
    })

    await logAudit(
      req,
      'FORCE_RESET_PASSWORD_SUCCESS',
      `Password reset successfully after forced reset for user: ${user.email}`,
      user.id,
    )

    // 🌟 การแจ้งเตือนคือ control หลักที่แทน email OTP — บันทึกว่าใครเปลี่ยนเมื่อไหร่จากที่ไหน
    await notifySupervisors(
      'FORCE_RESET_PASSWORD_COMPLETED',
      `แอดมิน ${user.firstname} ${user.lastname} (${user.email}) ตั้งรหัสผ่านใหม่สำเร็จ`,
      `IP: ${ipAddress} | Device: ${userAgent}`,
    )

    res.status(200).json({
      success: true,
      message: 'ตั้งรหัสผ่านใหม่สำเร็จ',
    })
  },
)
