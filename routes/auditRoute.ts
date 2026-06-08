// routes/auditRoute.ts
import express, { Request, Response, Router } from 'express'
import asyncHandler from 'express-async-handler' // 🌟 นำเข้า asyncHandler
import prisma from '../lib/prisma'
import auth from '../middlewares/auth'

const router: Router = express.Router()

router.get(
  '/',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    // ดักสิทธิ์ ADMIN (ถ้ามีระบบ Role)
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // ดึงมาแสดง 100 รายการล่าสุดก่อนเพื่อความเร็ว
    })
    res.status(200).json({ success: true, data: logs })
  }),
)

export default router
