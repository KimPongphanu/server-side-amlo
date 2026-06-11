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
    const userId = req.query.userId ? Number(req.query.userId) : undefined

    const logs = await prisma.auditLog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100, // ดึงมาแสดง 100 รายการล่าสุด
    })
    res.status(200).json({ success: true, data: logs })
  }),
)

export default router
