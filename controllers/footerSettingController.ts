import asyncHandler from 'express-async-handler'
import { NextFunction, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { AppError } from '../utils/AppError'

// GET /api/settings — ดึง settings ทั้งหมด (สาธารณะ)
export const getAllSettings = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const settings = await prisma.site_settings.findMany()
  const map: Record<string, string> = {}
  settings.forEach((s: { key: string; value: string }) => {
    map[s.key] = s.value
  })
  res.status(200).json({ success: true, data: map })
})

// PUT /api/settings — อัปเดต settings (admin เท่านั้น)
export const updateSettings = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { settings } = req.body as {
    settings: { key: string; value: string }[]
  }

  if (!Array.isArray(settings)) {
    throw new AppError('ข้อมูล settings ต้องเป็น array', 400)
  }

  for (const item of settings) {
    if (typeof item.key !== 'string' || typeof item.value !== 'string') {
      throw new AppError('ข้อมูล key และ value ต้องเป็น string', 400)
    }
  }

  await prisma.$transaction(
    settings.map((item) =>
      prisma.site_settings.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      }),
    ),
  )

  // Return updated map
  const all = await prisma.site_settings.findMany()
  const map: Record<string, string> = {}
  all.forEach((s: { key: string; value: string }) => {
    map[s.key] = s.value
  })

  res
    .status(200)
    .json({ success: true, data: map, message: 'บันทึกการตั้งค่าสำเร็จ' })
})
