// middlewares/auth.ts
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: any
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): any => {
  try {
    const token = req.cookies.token

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Access Denied: No Token Provided' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return res
        .status(500)
        .json({ message: 'JWT Secret configuration missing' })
    }

    const decoded = jwt.verify(token, secret)
    req.user = decoded // ใน decoded จะมีฟิลด์ role ที่เราฝังไว้จากตอน Login

    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Token' })
  }
}

// 🌟 เพิ่มฟังก์ชันนี้เพื่อดักสิทธิ์ Role (เช่น 'ADMIN')
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // ตรวจสอบว่ามีข้อมูล user และ role ตรงกับสิทธิ์ที่อนุญาตหรือไม่
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์เข้าถึงหรือทำรายการในส่วนนี้ (Forbidden)',
      })
      return
    }
    next()
  }
}

export default authMiddleware
