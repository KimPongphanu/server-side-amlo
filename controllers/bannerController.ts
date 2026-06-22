import { NextFunction, Request, Response } from 'express'
import fs from 'fs/promises'
import path from 'path'
import prisma from '../lib/prisma'
import { AppError } from '../utils/AppError'

// GET /api/banners — ดึงรายการ banners ทั้งหมด (เฉพาะ isShow = true สำหรับ public)
export const getAllBanners = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { all } = req.query
  const where = all === 'true' ? {} : { isShow: true }

  const banners = await prisma.banners.findMany({
    where,
    orderBy: { order: 'asc' },
  })

  res.status(200).json({
    success: true,
    data: banners,
  })
}

// POST /api/banners — เพิ่ม banner ใหม่
export const createBanner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const file = req.file

  if (!file) {
    throw new AppError('กรุณาอัปโหลดรูปภาพ', 400)
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const filePath = path.join(process.cwd(), file.path)
    await fs.unlink(filePath).catch(() => {})
    throw new AppError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น', 400)
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_FILE_SIZE) {
    const filePath = path.join(process.cwd(), file.path)
    await fs.unlink(filePath).catch(() => {})
    throw new AppError('ขนาดไฟล์ต้องไม่เกิน 5MB', 400)
  }

  const maxOrder = await prisma.banners.aggregate({
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '')

  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  const link_url =
    typeof req.body.link_url === 'string' ? req.body.link_url.trim() : ''

  const newBanner = await prisma.banners.create({
    data: {
      image_url: `/uploads/${sanitizedFilename}`,
      title,
      link_url,
      order: nextOrder,
    },
  })

  res.status(201).json({
    success: true,
    data: newBanner,
  })
}

// PUT /api/banners/reorder — บันทึกลำดับใหม่
export const reorderBanners = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { orderedIds } = req.body as { orderedIds: number[] }

  if (!Array.isArray(orderedIds)) {
    throw new AppError('ข้อมูลลำดับต้องเป็น array', 400)
  }

  if (orderedIds.length === 0) {
    throw new AppError('ข้อมูลลำดับไม่ถูกต้อง', 400)
  }

  if (
    !orderedIds.every(
      (id: unknown) => typeof id === 'number' && Number.isInteger(id) && id > 0,
    )
  ) {
    throw new AppError('ข้อมูล ID ไม่ถูกต้อง', 400)
  }

  const existingBanners = await prisma.banners.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  })

  const existingIds = new Set(existingBanners.map((s: { id: number }) => s.id))
  const invalidIds = orderedIds.filter((id) => !existingIds.has(id))

  if (invalidIds.length > 0) {
    throw new AppError(`ไม่พบ Banner ID: ${invalidIds.join(', ')}`, 404)
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.banners.update({
        where: { id },
        data: { order: index },
      }),
    ),
  )

  res.status(200).json({
    success: true,
    message: 'บันทึกลำดับสำเร็จ',
  })
}

// PUT /api/banners/:id — อัปเดต title และ link_url
export const updateBanner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)

  if (isNaN(id) || id <= 0) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  const existing = await prisma.banners.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('ไม่พบ Banner ที่ต้องการแก้ไข', 404)
  }

  const data: { title?: string; link_url?: string } = {}

  if (typeof req.body.title === 'string') {
    data.title = req.body.title.trim()
  }
  if (typeof req.body.link_url === 'string') {
    data.link_url = req.body.link_url.trim()
  }

  const updated = await prisma.banners.update({
    where: { id },
    data,
  })

  res.status(200).json({
    success: true,
    data: updated,
  })
}

// PATCH /api/banners/:id/toggle — เปิด/ปิด isShow
export const toggleBannerVisibility = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)

  if (isNaN(id) || id <= 0) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  const existing = await prisma.banners.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('ไม่พบ Banner ที่ต้องการแก้ไข', 404)
  }

  const updated = await prisma.banners.update({
    where: { id },
    data: { isShow: !existing.isShow },
  })

  res.status(200).json({
    success: true,
    data: updated,
  })
}

// DELETE /api/banners/:id — ลบ banner
export const deleteBanner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)

  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  const banner = await prisma.banners.findUnique({ where: { id } })

  if (!banner) {
    throw new AppError('ไม่พบ Banner ที่ต้องการลบ', 404)
  }

  if (banner.image_url) {
    const filePath = path.join(process.cwd(), banner.image_url)
    await fs.unlink(filePath).catch(() => {})
  }

  await prisma.banners.delete({ where: { id } })

  res.status(200).json({
    success: true,
    message: 'ลบ Banner สำเร็จ',
  })
}
