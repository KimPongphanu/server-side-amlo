// middlewares/rateLimiter.ts
import { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

// Custom key generator: use userId if logged in, fallback to IP
const keyGenerator = (req: Request): string => {
  return (req as any).user?.uuid || req.ip || 'unknown'
}

// ── Login Limiter ────────────────────────────────────────────
// Higher limit + longer window + skip success + log blocked
export const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 นาที
  max: 10, // 10 ครั้ง
  keyGenerator,
  skipSuccessfulRequests: true,
  message: {
    message:
      'คุณลองเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่อีกครั้งในอีก 30 นาที',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[RATE-LIMIT] login blocked for key: ${keyGenerator(req)}`)
    res.status(429).json({
      message:
        'คุณลองเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่อีกครั้งในอีก 30 นาที',
    })
  },
})

// ── Register Limiter ─────────────────────────────────────────
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ชม.
  max: 3,
  keyGenerator,
  message: {
    message: 'คุณทำการสมัครสมาชิกถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 1 ชั่วโมง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Upload Limiter ───────────────────────────────────────────
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator,
  message: {
    message: 'คุณอัปโหลดไฟล์ถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Public API Limiter (general) ─────────────────────────────
// Higher limit: normal user won't hit this
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  keyGenerator,
  message: { message: 'ระบบตรวจพบการเรียกใช้งานที่ถี่เกินไป' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Comment Limiter ──────────────────────────────────────────
export const commentRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 นาที
  max: 10,
  keyGenerator,
  message: {
    success: false,
    message: 'คุณส่งความคิดเห็นบ่อยเกินไป กรุณารอ 30 นาที แล้วลองใหม่อีกครั้ง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
