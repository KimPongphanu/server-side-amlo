import { NextFunction, Request, Response } from 'express'
import fs from 'fs/promises'
import path from 'path'
import prisma from '../lib/prisma'
import { AppError } from '../utils/AppError'

// GET /api/splash-popups — ดึงทั้งหมด (admin)
export const getAllPopups = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const popups = await prisma.splash_popups.findMany({
    orderBy: { createdAt: 'desc' },
  })
  res.status(200).json({ success: true, data: popups })
}

// GET /api/splash-popups/active — ดึง popup ที่ active อยู่ (public)
export const getActivePopup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const popup = await prisma.splash_popups.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  res.status(200).json({ success: true, data: popup || null })
}

// POST /api/splash-popups — สร้าง popup ใหม่
export const createPopup = async (
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

  const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''

  const popup = await prisma.splash_popups.create({
    data: {
      image_url: `/uploads/${sanitizedFilename}`,
      title,
    },
  })

  res.status(201).json({ success: true, data: popup })
}

// PUT /api/splash-popups/:id — อัปเดต popup (activate, deactivate, title)
export const updatePopup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)
  if (isNaN(id) || id <= 0) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  const existing = await prisma.splash_popups.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('ไม่พบ Popup', 404)
  }

  const data: { title?: string; isActive?: boolean } = {}

  if (typeof req.body.title === 'string') {
    data.title = req.body.title.trim()
  }
  if (typeof req.body.isActive === 'boolean') {
    // ถ้าต้องการ activate ตัวนี้ ให้ deactivate ตัวอื่นก่อน
    if (req.body.isActive) {
      await prisma.splash_popups.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
    }
    data.isActive = req.body.isActive
  }

  const updated = await prisma.splash_popups.update({
    where: { id },
    data,
  })

  res.status(200).json({ success: true, data: updated })
}

// DELETE /api/splash-popups/:id — ลบ popup
export const deletePopup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const id = parseInt(String(req.params.id), 10)
  if (isNaN(id) || id <= 0) {
    throw new AppError('ID ไม่ถูกต้อง', 400)
  }

  const popup = await prisma.splash_popups.findUnique({ where: { id } })
  if (!popup) {
    throw new AppError('ไม่พบ Popup', 404)
  }

  if (popup.image_url) {
    const filePath = path.join(process.cwd(), popup.image_url)
    await fs.unlink(filePath).catch(() => {})
  }

  await prisma.splash_popups.delete({ where: { id } })
  res.status(200).json({ success: true, message: 'ลบ Popup สำเร็จ' })
}
