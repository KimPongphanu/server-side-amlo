// middlewares/rateLimiter.ts
import rateLimit from 'express-rate-limit'

// ตั้งค่าตัวจำกัดสิทธิ์สำหรับหน้า Register โดยเฉพาะ
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 🔒 กำหนดช่วงเวลาตรวจสอบทุกๆ 15 นาที
  max: 5, // 🛑 จำกัดให้ IP เดิมสามารถยิงสมัครสมาชิกได้สูงสุดแค่ 5 ครั้งต่อรอบเวลา
  message: {
    message:
      'คุณทำการส่งคำขอสมัครสมาชิกถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
  },
  standardHeaders: true, // ส่งกลับข้อมูลบอกสถานะขีดจำกัดในเครื่องหมาย Headers (X-RateLimit-Limit)
  legacyHeaders: false, // ปิดใช้งาน Headers รุ่นเก่าที่ไม่ได้มาตรฐานออกไป
})

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ตรวจสอบสถานะทุกๆ 15 นาที
  max: 50, // บล็อก IP ทันทีหากพิมพ์รหัสผิดติดต่อกันเกิน 5 ครั้ง
  message: {
    message:
      'คุณลองเข้าสู่ระบบเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // อัปโหลดได้สูงสุด 10 ครั้งต่อ 15 นาที
  message: {
    message: 'คุณทำรายการอัปโหลดถี่เกินไป กรุณาลองใหม่อีกครั้งในอีก 15 นาที',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// สำหรับกลุ่มดึงข้อมูลทั่วไป (Public API)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // เรียกดูข้อมูลได้ 100 ครั้งต่อ 15 นาที
  message: { message: 'ระบบตรวจพบการเรียกใช้งานที่ถี่เกินไป' },
  standardHeaders: true,
  legacyHeaders: false,
})
