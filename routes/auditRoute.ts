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
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const sortField = (req.query.sort as string) || 'createdAt'
    const sortOrder = (req.query.order as string) === 'asc' ? 'asc' : 'desc'
    const skip = (page - 1) * limit

    const validSortFields = ['createdAt', 'action', 'ipAddress']
    const orderBy = validSortFields.includes(sortField)
      ? { [sortField]: sortOrder }
      : { createdAt: 'desc' }

    const action = req.query.action as string | undefined
    const q = req.query.q as string | undefined

    const where: any = {}
    if (userId) where.userId = userId
    if (action && action !== 'all') where.action = action
    if (q && q.trim()) {
      const searchTerm = q.trim()
      where.OR = [
        { action: { contains: searchTerm, mode: 'insensitive' } },
        { details: { contains: searchTerm, mode: 'insensitive' } },
        { ipAddress: { contains: searchTerm } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }),
)

export default router
