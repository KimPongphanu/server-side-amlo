// middlewares/auth.ts - ตรวจสอบ export
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    uuid: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
  session?: {
    id: string
    userId: number
  }
}

const hashToken = (token: string): string => {
  return require('crypto').createHash('sha256').update(token).digest('hex')
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

    req.user = decoded
    next()
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
