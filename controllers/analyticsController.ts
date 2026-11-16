// controllers/analyticsController.ts
import asyncHandler from 'express-async-handler'
import { NextFunction, Request, Response } from 'express'
import {
  getCachedVisitorStats,
  readGaConfig,
} from '../services/gaService'

/**
 * GET /api/analytics/visitors
 * สาธารณะ — ใช้แสดงตัวเลขผู้เข้าชมบน Footer
 *
 * - ยังไม่ตั้งค่า GA  → 200 { success: true, data: { configured: false } }
 *   (ไม่ใช่ error เพื่อให้ frontend fallback ไปใช้ค่า visitor_count เดิมได้)
 * - ตั้งค่าแล้วแต่มือถือ/เน็ตล่ม → 502 พร้อม configured: true เพื่อให้แยกออกว่า
 *   "ยังไม่ตั้งค่า" กับ "ดึงไม่สำเร็จ" ไม่ใช่เรื่องเดียวกัน
 */
export const getVisitors = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const config = readGaConfig()

  if (!config) {
    res.status(200).json({
      success: true,
      data: { configured: false },
    })
    return
  }

  const bypassCache = req.query.refresh === '1'

  try {
    const stats = await getCachedVisitorStats(config, { bypassCache })
    res.status(200).json({ success: true, data: stats })
  } catch (error) {
    // 🌟 ไม่ให้ error ดิบหลุดออกไป — private key / client email อยู่ในข้อความ error ได้
    console.error(
      '[Analytics] GA fetch failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    res.status(502).json({
      success: false,
      data: { configured: true },
      message: 'ไม่สามารถดึงข้อมูลผู้เข้าชมได้ในขณะนี้',
    })
  }
})
