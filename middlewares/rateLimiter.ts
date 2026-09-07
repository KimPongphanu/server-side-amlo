// middlewares/rateLimiter.ts
import { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

// Custom key generator: use userId if logged in, fallback to req.ip
// ⚠️ ห้ามอ่าน header X-Forwarded-For โดยตรง — attacker ปลอม header นี้ได้
//    `req.ip` ปลอดภัยกว่า เพราะ Express คำนวณจาก trusted proxy chain ให้แล้ว (trust proxy = 1)
const keyGenerator = (req: Request): string => {
  return (req as any).user?.uuid || req.ip || 'unknown'
}

// ── Login Limiter ────────────────────────────────────────────
export const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  keyGenerator,
  skipSuccessfulRequests: true,
  validate: false,
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
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator,
  validate: false,
  message: {
    message: 'คุณทำการสมัครสมาชิกถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 1 ชั่วโมง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Upload Limiter ───────────────────────────────────────────
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // allow bulk slider/banner uploads
  keyGenerator,
  validate: false,
  message: {
    message: 'คุณอัปโหลดไฟล์ถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Public API Limiter (general) ─────────────────────────────
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  keyGenerator,
  validate: false,
  message: { message: 'ระบบตรวจพบการเรียกใช้งานที่ถี่เกินไป' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Comment Limiter ──────────────────────────────────────────
export const commentRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  keyGenerator,
  validate: false,
  message: {
    success: false,
    message: 'คุณส่งความคิดเห็นบ่อยเกินไป กรุณารอ 30 นาที แล้วลองใหม่อีกครั้ง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── OTP Send Limiter (ป้องกัน email bombing / SMTP quota exhaustion) ──
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator,
  validate: false,
  message: {
    success: false,
    message: 'คุณขอรหัส OTP บ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่อีกครั้ง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── OTP Verify Limiter (ป้องกัน brute force OTP / recovery key) ──
export const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator,
  validate: false,
  message: {
    success: false,
    message: 'คุณยืนยันข้อมูลผิดบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Contact Form Limiter (ป้องกันสแปมเมลหา Supervisor) ───────
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator,
  validate: false,
  message: {
    success: false,
    message: 'คุณส่งข้อความติดต่อบ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่อีกครั้ง',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
