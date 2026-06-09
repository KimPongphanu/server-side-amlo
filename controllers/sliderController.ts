import { NextFunction, Request, Response } from 'express'
import fs from 'fs/promises'
import path from 'path'
import prisma from '../lib/prisma'
import { AppError } from '../utils/AppError' // ถ้ามี custom error class

// GET /api/slider - ดึงรายการสไลด์ทั้งหมด
export const getAllSlides = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const slides = await prisma.sliderImage.findMany({
    orderBy: { order: 'asc' },
  })

  res.status(200).json({
    success: true,
    data: slides,
  })
}

// POST /api/slider - เพิ่มรูปภาพใหม่
export const createSlide = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const file = req.file

  if (!file) {
    throw new AppError('กรุณาอัปโหลดรูปภาพ', 400)
  }

  // OWASP: Validate file type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimeTypes.includes(file.mimetype)) {
    // ลบไฟล์ที่ไม่ได้รับอนุญาตทิ้ง
    const filePath = path.join(process.cwd(), file.path)
    await fs.unlink(filePath).catch(() => {})

    throw new AppError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น', 400)
  }

  // OWASP: Validate file size (เพิ่มเติมจาก multer limits)
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_FILE_SIZE) {
    const filePath = path.join(process.cwd(), file.path)
    await fs.unlink(filePath).catch(() => {})

    throw new AppError('ขนาดไฟล์ต้องไม่เกิน 5MB', 400)
  }

  // หา order ล่าสุด
  const maxOrder = await prisma.sliderImage.aggregate({
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? -1) + 1

  // OWASP: Sanitize filename before saving
  const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '')

  const newSlide = await prisma.sliderImage.create({
    data: {
      image_url: `/uploads/${sanitizedFilename}`,
      order: nextOrder,
    },
  })

  res.status(201).json({
    success: true,
    data: newSlide,
  })
}

// PUT /api/slider/reorder - บันทึกลำดับใหม่
export const reorderSlides = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { orderedIds } = req.body as { orderedIds: number[] }

  // OWASP: Input validation
  if (!Array.isArray(orderedIds)) {
    throw new AppError('ข้อมูลลำดับต้องเป็น array', 400)
  }

  if (orderedIds.length === 0) {
    throw new AppError('ข้อมูลลำดับไม่ถูกต้อง', 400)
  }

  // OWASP: Validate array elements
  if (
    !orderedIds.every(
      (id: unknown) => typeof id === 'number' && Number.isInteger(id) && id > 0,
    )
  ) {
    throw new AppError('ข้อมูล ID ไม่ถูกต้อง', 400)
  }

  // ตรวจสอบว่า ID ทั้งหมดมีอยู่จริง
  const existingSlides = await prisma.sliderImage.findMany({
    where: {
      id: {
        in: orderedIds,
      },
    },
    select: { id: true },
  })

  // ระบุ type ให้ชัดเจน
  const existingIds = new Set(existingSlides.map((s: { id: number }) => s.id))
  const invalidIds = orderedIds.filter((id: number) => !existingIds.has(id))

  if (invalidIds.length > 0) {
    throw new AppError(`ไม่พบสไลด์ ID: ${invalidIds.join(', ')}`, 404)
  }

  // Transaction เพื่อความปลอดภัยของข้อมูล
  await prisma.$transaction(
    orderedIds.map((id: number, index: number) =>
      prisma.sliderImage.update({
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

// DELETE /api/slider/:id - ลบสไลด์
export const deleteSlide = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)

  // OWASP: Validate ID parameter
  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  // ตรวจสอบว่ามีสไลด์นี้อยู่จริง
  const slide = await prisma.sliderImage.findUnique({
    where: { id },
  })

  if (!slide) {
    throw new AppError('ไม่พบสไลด์ที่ต้องการลบ', 404)
  }

  // ลบไฟล์รูปภาพออกจาก storage
  if (slide.image_url) {
    const filePath = path.join(process.cwd(), slide.image_url)
    await fs.unlink(filePath).catch(() => {
      // ไม่ throw error ถ้าลบไฟล์ไม่สำเร็จ เพราะอาจไม่มีไฟล์อยู่แล้ว
    })
  }

  await prisma.sliderImage.delete({
    where: { id },
  })

  res.status(200).json({
    success: true,
    message: 'ลบสไลด์สำเร็จ',
  })
}
