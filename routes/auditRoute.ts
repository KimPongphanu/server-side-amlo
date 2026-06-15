// routes/auditRoute.ts
import express, { Request, Response, Router } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import auth, { restrictTo } from '../middlewares/auth'

const router: Router = express.Router()

router.get(
  '/',
  auth,
  restrictTo('SUPERVISOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined

    const logs = await prisma.auditLog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            email: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    })
    res.status(200).json({ success: true, data: logs })
  }),
)

export default router
