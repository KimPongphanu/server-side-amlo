// middlewares/csrf.ts
// 🌟 CSRF Double-Submit Cookie — ชั้นป้องกันเพิ่มเติมนอกเหนือจาก SameSite + JSON-only body
// หลักการ: cookie csrf_token (ตั้งใจให้ JS อ่านได้ — httpOnly: false) ต้องมาคู่กับ header X-CSRF-Token
// Attacker จากเว็บอื่นอ่าน cookie ของเราไม่ได้ (same-origin policy) จึงปลอม header ไม่ได้
// แม้ SameSite จะถูก bypass (browser เก่า) การโจมตี CSRF ก็ยังถูกบล็อกที่ชั้นนี้
import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Public pre-auth endpoints — ยังไม่มี csrf cookie ให้ตรวจ
 * (ป้องกันด้วย rate limiter + SameSite cookie อยู่แล้ว)
 * ⚠️ ห้ามเพิ่ม endpoint ที่ต้อง login หรือเปลี่ยน state ของผู้ใช้เข้า list นี้
 */
const EXEMPT_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/check-email',
  '/api/auth/reset-password',
  '/api/contact',
  '/api/comments',
  '/api/2fa/verify-login',
  '/api/2fa/recovery/use',
])

export const generateCsrfToken = (): string =>
  crypto.randomBytes(32).toString('hex')

/** ตั้ง cookie csrf_token — ต้องเรียกคู่กับจุดออก auth cookie ทุกจุด */
export const setCsrfCookie = (res: Response, token: string): string => {
  res.cookie('csrf_token', token, {
    httpOnly: false, // 🌟 ตั้งใจ — JS ต้องอ่านค่าไปใส่ header (double-submit pattern)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  })
  return token
}

/** เทียบค่าแบบ timing-safe กัน timing attack */
const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }

  // 🌟 middleware นี้ mount ระดับ app → req.path เป็น path เต็ม (/api/...)
  if (EXEMPT_PATHS.has(req.path)) {
    next()
    return
  }

  const cookieToken = req.cookies?.csrf_token as string | undefined
  const rawHeader = req.headers['x-csrf-token']
  const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

  if (cookieToken && headerToken && safeEqual(cookieToken, headerToken)) {
    next()
    return
  }

  res.status(403).json({
    success: false,
    message:
      'CSRF token ไม่ถูกต้องหรือขาดหาย กรุณารีเฟรชหน้าเว็บ/เข้าสู่ระบบใหม่อีกครั้ง',
  })
}
