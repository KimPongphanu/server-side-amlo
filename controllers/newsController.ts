import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import DOMPurify from 'isomorphic-dompurify'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'
import { translateToEnglish } from '../utils/translateService'

export const createNews = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { title, description, content, type } = req.body

    if (!title || !description) {
      res.status(400).json({ message: 'กรุณากรอกหัวข้อและรายละเอียดสั้น' })
      return
    }

    if (title.length > 150 || description.length > 500) {
      res.status(400).json({ message: 'ตัวอักษรมีความยาวเกินกำหนด' })
      return
    }

    if (!req.file) {
      res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพหน้าปกข่าว' })
      return
    }

    // 🌟 Sanitize เนื้อหา HTML ก่อนนำไปใช้งาน
    const sanitizedContent = content ? DOMPurify.sanitize(content) : null
    const imagePath = `/uploads/${req.file.filename}`

    // 🌟 แปลภาษาอังกฤษ
    const title_en = await translateToEnglish(title)
    const description_en = await translateToEnglish(description)
    const content_en = await translateToEnglish(sanitizedContent)

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
  },
)

export const getNews = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1
  const limit = parseInt(String(req.query.limit)) || 10
  const type = String(req.query.type)
  const isAll = req.query.all === 'true'
  const skip = (page - 1) * limit

  const whereCondition: any = {}
  
  if (!isAll) {
    whereCondition.isShow = true
  }

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
      res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' })
      return
    }

    const { title, description, content, isShow, views, type, date } = req.body

    const oldNews = await prisma.news.findUnique({ where: { id } })
    if (!oldNews) {
      res
        .status(404)
        .json({ success: false, message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' })
      return
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

    const updatedNews = await prisma.news.update({
      where: { id },
      data: updateData,
    })

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
  },
)
