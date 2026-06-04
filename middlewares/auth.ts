// middlewares/auth.ts
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: any
}

const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): any => {
  try {
    // 🔒 เปลี่ยนจากดักอ่าน Authorization Header มาอ่านจาก cookie-parser แทน
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
    req.user = decoded

    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid Token' })
  }
}

export default authMiddleware
