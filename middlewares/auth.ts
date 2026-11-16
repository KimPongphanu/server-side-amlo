// middlewares/auth.ts - ตรวจสอบ export
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { decideBootstrapAccess } from '../utils/bootstrapGate'
import { validateAndUpdateSession } from './session'

export interface AuthRequest extends Request {
  user?: {
    id: number
    uuid: string
    email: string
    firstName: string
    lastName: string
    role: string
    forcePasswordReset?: boolean
    twoFactorEnabled?: boolean
  }
  session?: {
    id: string
    userId: number
  }
}

const hashToken = (token: string): string => {
  return require('crypto').createHash('sha256').update(token).digest('hex')
}

/**
 * 🌟 Bootstrap gate (fail-closed).
 *
 * บัญชีที่ถูก flag forcePasswordReset ยังไม่ใช่ session ปกติ — ต้องเดินตามลำดับ
 * 2FA enrollment -> เปลี่ยนรหัสผ่านชั่วคราว เท่านั้น (ตรรกะอยู่ใน utils/bootstrapGate)
 *
 * ตอบ 428 (ไม่ใช่ 403) เพราะ frontend utils/api.ts จะ redirect ไป /login เมื่อเจอ 403
 * และต้องแนบ code ให้ SPA route ไปขั้นที่ถูกต้องได้
 *
 * ⚠️ ใช้ baseUrl + path เพราะ middleware นี้ถูก mount ใน router
 */
const enforceBootstrapFlow = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const decision = decideBootstrapAccess({
    forcePasswordReset: req.user?.forcePasswordReset,
    twoFactorEnabled: req.user?.twoFactorEnabled,
    fullPath: `${req.baseUrl}${req.path}`,
  })

  if (decision.allowed) {
    next()
    return
  }

  res.status(428).json({
    success: false,
    code:
      decision.stage === 'ENROLL_2FA'
        ? 'ENROLL_2FA_REQUIRED'
        : 'PASSWORD_CHANGE_REQUIRED',
    message: decision.reason,
  })
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies.token

    if (!token) {
      res.status(401).json({ message: 'Access Denied: No Token Provided' })
      return
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      res.status(500).json({ message: 'JWT Secret configuration missing' })
      return
    }

    const decoded = jwt.verify(token, secret) as {
      uuid: string
      email: string
      firstName: string
      lastName: string
      role: string
    }

    // 🌟 ตรวจสอบ JWT Blacklist (token ที่ถูก logout แล้ว — เก็บในรูป SHA-256 hash)
    const isBlacklisted = await prisma.jwtBlacklist.findUnique({
      where: { token: hashToken(token) },
    })
    if (isBlacklisted) {
      res.clearCookie('token')
      res.status(401).json({ message: 'Token ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่' })
      return
    }

    // 🌟 เช็คสถานะผู้ใช้จาก Database (ban / forcePasswordReset / 2FA)
    const user = await prisma.user.findUnique({
      where: { uuid: decoded.uuid },
      select: {
        id: true,
        status: true,
        forcePasswordReset: true,
        twoFactorEnabled: true,
      },
    })

    if (!user) {
      res.clearCookie('token')
      res.status(401).json({ message: 'User account not found' })
      return
    }

    if (user.status === 'Inactive') {
      res.clearCookie('token')
      res.status(401).json({ message: 'บัญชีนี้ถูกระงับการใช้งาน' })
      return
    }

    req.user = {
      ...decoded,
      id: user.id,
      forcePasswordReset: user.forcePasswordReset,
      twoFactorEnabled: user.twoFactorEnabled,
    }

    // 🌟 Session ต้องผ่านก่อน (inactivity / revoke / force logout) แล้วจึงเข้า gate
    await validateAndUpdateSession(req, res, () => {
      if (res.headersSent) return
      enforceBootstrapFlow(req, res, next)
    })
  } catch (error) {
    res.clearCookie('token')
    res.status(401).json({ message: 'Invalid Token' })
  }
}

export const restrictTo = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      })
      return
    }
    next()
  }
}

export const requireSupervisor = restrictTo('SUPERVISOR')
export const requireAdmin = restrictTo('ADMIN', 'SUPERVISOR')

// Default export for backward compatibility
const authMiddlewareExport = authMiddleware
export default authMiddlewareExport
