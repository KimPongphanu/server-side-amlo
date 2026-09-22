import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import DOMPurify from 'isomorphic-dompurify'
import fs from 'fs/promises'
import path from 'path'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'
import { translateToEnglish } from '../utils/translateService'
import { validateMagicBytes } from '../utils/fileValidator'
import { convertUploadToWebp } from '../utils/imageProcessing'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** ลบไฟล์ที่ multer เขียนลงดิสก์แล้ว (ใช้เมื่อ request ถูกปฏิเสธหรือบันทึก DB ไม่สำเร็จ) */
const cleanupUpload = async (file?: Express.Multer.File): Promise<void> => {
  if (!file) return
  await fs.unlink(path.join(process.cwd(), file.path)).catch(() => {})
}

/** ตรวจชนิดไฟล์ + magic bytes พร้อมลบไฟล์ทิ้งถ้าไม่ผ่าน */
const validateUploadedImage = async (
  file: Express.Multer.File,
): Promise<string | null> => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    await cleanupUpload(file)
    return 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น'
  }

  const isValid = await validateMagicBytes(
    path.join(process.cwd(), file.path),
    file.mimetype,
  )

  if (!isValid) {
    await cleanupUpload(file)
    return 'ไฟล์รูปภาพไม่ถูกต้องหรืออาจเป็นไฟล์อันตรายแฝงตัวมา'
  }

  return null
}

export const createNews = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { title, description, content, type, date } = req.body

    if (!title || !description) {
      await cleanupUpload(req.file)
      res.status(400).json({ message: 'กรุณากรอกหัวข้อและรายละเอียดสั้น' })
      return
    }

    if (title.length > 150 || description.length > 500) {
      await cleanupUpload(req.file)
      res.status(400).json({ message: 'ตัวอักษรมีความยาวเกินกำหนด' })
      return
    }

    if (!req.file) {
      res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพหน้าปกข่าว' })
      return
    }

    const fileError = await validateUploadedImage(req.file)
    if (fileError) {
      res.status(400).json({ message: fileError })
      return
    }

    // 🌟 แปลงเป็น WebP (ตัด EXIF + จำกัดด้านยาว) ก่อนบันทึก
    await convertUploadToWebp(req.file)

    // 🌟 Sanitize เนื้อหา HTML ก่อนนำไปใช้งาน
    const sanitizedContent = content ? DOMPurify.sanitize(content) : null
    const imagePath = `/uploads/${req.file.filename}`

    try {
      // 🌟 แปลภาษาอังกฤษ
      const title_en = await translateToEnglish(title)
      const description_en = await translateToEnglish(description)
      const content_en = await translateToEnglish(sanitizedContent)

      const parsedDate = date ? new Date(date) : null
      const dateData =
        parsedDate && !isNaN(parsedDate.getTime()) ? { date: parsedDate } : {}

      const news = await prisma.news.create({
        data: {
          type: type === 'PR' ? 'PR' : 'NEWS',
          title,
          title_en,
          description,
          description_en,
          content: sanitizedContent,
          content_en,
          image_src: imagePath,
          ...dateData,
        },
      })

      const adminUser = await prisma.user.findUnique({
        where: { uuid: req.user?.uuid },
      })

      await logAudit(
        req,
        'CREATE_NEWS_SUCCESS',
        `Admin created a new news/event: "${title.trim()}" (ID: ${news.id}, Type: ${news.type})`,
        adminUser?.id,
      )

      res.status(201).json({ message: 'สร้างข่าวสารสำเร็จ', newsRef: news.id })
    } catch (error) {
      await cleanupUpload(req.file)
      throw error
    }
  },
)

export const getNews = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1
  const limit = parseInt(String(req.query.limit)) || 10
  const type = String(req.query.type)
  const skip = (page - 1) * limit

  // 🌟 Public — แสดงเฉพาะ isShow = true เสมอ (admin ใช้ GET /api/news/all)
  const whereCondition: any = { isShow: true }

  if (type === 'PR' || type === 'NEWS') {
    whereCondition.type = type
  }

  const [newsList, totalItems] = await prisma.$transaction([
    prisma.news.findMany({
      where: whereCondition,
      orderBy: { date: 'desc' },
      skip: skip,
      take: limit,
    }),
    prisma.news.count({ where: whereCondition }),
  ])

  res.status(200).json({
    success: true,
    data: newsList,
    pagination: {
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    },
  })
})

// 🌟 GET /api/news/all — Admin/Supervisor only: ดูทุกข่าวรวมที่ถูกซ่อน (isShow = false)
export const getAllNews = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1
  const limit = parseInt(String(req.query.limit)) || 10
  const type = String(req.query.type)
  const skip = (page - 1) * limit

  const whereCondition: any = {}

  if (type === 'PR' || type === 'NEWS') {
    whereCondition.type = type
  }

  const [newsList, totalItems] = await prisma.$transaction([
    prisma.news.findMany({
      where: whereCondition,
      orderBy: { date: 'desc' },
      skip: skip,
      take: limit,
    }),
    prisma.news.count({ where: whereCondition }),
  ])

  res.status(200).json({
    success: true,
    data: newsList,
    pagination: {
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    },
  })
})

export const updateNews = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params.id))
    if (isNaN(id)) {
      await cleanupUpload(req.file)
      res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' })
      return
    }

    const { title, description, content, isShow, views, type, date } = req.body

    const oldNews = await prisma.news.findUnique({ where: { id } })
    if (!oldNews) {
      await cleanupUpload(req.file)
      res
        .status(404)
        .json({ success: false, message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' })
      return
    }

    if (req.file) {
      const fileError = await validateUploadedImage(req.file)
      if (fileError) {
        res.status(400).json({ success: false, message: fileError })
        return
      }

      // 🌟 แปลงเป็น WebP (ตัด EXIF + จำกัดด้านยาว) ก่อนบันทึก
      await convertUploadToWebp(req.file)
    }

    // 🌟 Sanitize เนื้อหาตอนอัปเดตข้อมูล
    const sanitizedContent = content ? DOMPurify.sanitize(content) : null

    const updateData: {
      title?: string
      title_en?: string | null
      description?: string
      description_en?: string | null
      content?: string | null
      content_en?: string | null
      image_src?: string
      isShow?: boolean
      views?: number
      type?: 'NEWS' | 'PR'
      date?: Date
    } = {}

    if (title !== undefined) {
      updateData.title = title
      updateData.title_en = await translateToEnglish(title)
    }
    if (description !== undefined) {
      updateData.description = description
      updateData.description_en = await translateToEnglish(description)
    }
    if (content !== undefined) {
      updateData.content = sanitizedContent
      updateData.content_en = await translateToEnglish(sanitizedContent)
    }
    if (isShow !== undefined) updateData.isShow = isShow === 'true' || isShow === true
    if (views !== undefined) updateData.views = parseInt(views)
    if (type !== undefined) updateData.type = type
    if (date !== undefined) updateData.date = new Date(date)

    if (req.file) {
      updateData.image_src = `/uploads/${req.file.filename}`
    }

    try {
      const updatedNews = await prisma.news.update({
        where: { id },
        data: updateData,
      })

      // 🌟 ลบไฟล์รูปเก่าทิ้งเมื่อเปลี่ยนรูปใหม่สำเร็จ (กันไฟล์กำพร้าสะสมใน uploads)
      if (
        req.file &&
        oldNews.image_src &&
        oldNews.image_src.startsWith('/uploads/') &&
        oldNews.image_src !== updateData.image_src
      ) {
        await fs
          .unlink(path.join(process.cwd(), oldNews.image_src))
          .catch(() => {})
      }

      const adminUser = await prisma.user.findUnique({
        where: { uuid: req.user?.uuid },
      })

      await logAudit(
        req,
        'UPDATE_NEWS_SUCCESS',
        `Admin updated news/event: (ID: ${id}, Title: "${updatedNews.title}", Image updated: ${req.file ? 'Yes' : 'No'})`,
        adminUser?.id,
      )

      res.status(200).json({
        success: true,
        message: 'แก้ไขข้อมูลเสร็จสิ้น',
        data: updatedNews,
      })
    } catch (error) {
      await cleanupUpload(req.file)
      throw error
    }
  },
)
