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

    console.log('[AUTH DEBUG] Token present:', !!token)
    console.log('[AUTH DEBUG] Cookies:', req.cookies)
    console.log('[AUTH DEBUG] Path:', req.path)

    if (!token) {
      console.log('[AUTH DEBUG] No token - sending 401')
      res.status(401).json({ message: 'Access Denied: No Token Provided' })
      return
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.log('[AUTH DEBUG] No JWT_SECRET')
      res.status(500).json({ message: 'JWT Secret configuration missing' })
      return
    }

    const tokenHash = hashToken(token)

    // Check blacklist - SKIP for now to debug
    // const isBlacklisted = await prisma.jwtBlacklist.findUnique({
    //   where: { token: tokenHash },
    // })
    // if (isBlacklisted) { ... }

    // Check session - SKIP for now to debug
    // const session = await prisma.session.findFirst({ ... })
    // if (!session) { ... }

    // Just verify token for now
    const decoded = jwt.verify(token, secret) as {
      uuid: string
      email: string
      firstName: string
      lastName: string
      role: string
    }

    console.log('[AUTH DEBUG] Decoded user:', decoded.email)
    console.log('[AUTH DEBUG] User role:', decoded.role)

    req.user = decoded
    next()
  } catch (error) {
    console.error('[AUTH DEBUG] Error:', error)
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
