// routes/newsRoute.ts
import express, { Request, Response, Router } from 'express'
import prisma from '../lib/prisma'
import auth from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'

const router: Router = express.Router()

router.post(
  '/',
  auth,
  uploadLimiter,
  upload.single('image'),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { type, title, description, content } = req.body

      if (!title || !description) {
        return res
          .status(400)
          .json({ message: 'กรุณากรอกหัวข้อและรายละเอียดสั้น' })
      }

      if (title.length > 150 || description.length > 500) {
        return res.status(400).json({ message: 'ตัวอักษรมีความยาวเกินกำหนด' })
      }

      // ยังคงต้องเช็กว่ามีการส่งไฟล์มาไหม (ฟิลด์บังคับ)
      if (!req.file) {
        return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพหน้าปกข่าว' })
      }

      // ✂️ ลบบล็อกตรวจสอบ allowedMimeTypes เดิมออกได้เลย เพราะ Middleware จัดการให้แล้ว

      const imagePath = `/uploads/${req.file.filename}`

      const news = await prisma.news.create({
        data: {
          type: type === 'PR' ? 'PR' : 'NEWS',
          title,
          description,
          content,
          image_src: imagePath,
        },
      })

      res.status(201).json({ message: 'สร้างข่าวสารสำเร็จ', newsRef: news.id })
    } catch (error: any) {
      console.error('Create News Error:', error.message)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
    }
  },
)

// routes/newsRoute.ts

router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const type = req.query.type as string // 🌟 1. ดักรับพารามิเตอร์ type (เช่น PR หรือ NEWS)
    const skip = (page - 1) * limit

    // 🌟 2. สร้าง Object เงื่อนไขค้นหาฐานข้อมูล
    const whereCondition: any = { isShow: true }

    // ถ้าหน้าบ้านส่ง type มา และค่าตรงกับ Enum ในระบบ ให้ล็อกเงื่อนไขค้นหา
    if (type === 'PR' || type === 'NEWS') {
      whereCondition.type = type
    }

    const [newsList, totalItems] = await prisma.$transaction([
      prisma.news.findMany({
        where: whereCondition, // 🌟 3. ส่งเงื่อนไขกรองไปให้ฐานข้อมูลทำงาน
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
  } catch (error: any) {
    console.error('Get News Error:', error.message)
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดภายในระบบ' })
  }
})

/**
 * @ROUTE   PUT /api/news/:id
 * @DESC    อัปเดตแก้ไขข้อมูลข่าวหรือ PR ตาม ID ข้อมูล
 */
router.put(
  '/:id',
  upload.single('image'),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params
      const { title, description, content } = req.body

      // 1. จัดเตรียมข้อมูลพื้นฐานที่จะทำการอัปเดตลงฐานข้อมูล
      const updateData: any = {
        title,
        description,
        content,
      }

      // 2. ถ้าผู้ใช้งานแนบรูปปกใบใหม่เข้ามา ให้ทำการสลับเปลี่ยน path รูปภาพ
      if (req.file) {
        updateData.image_src = `/uploads/${req.file.filename}`
      }

      // 3. สั่งบันทึกแก้ไขข้อมูลลงฐานข้อมูลผ่าน Prisma Client
      const updatedNews = await prisma.news.update({
        where: { id: parseInt(id) },
        data: updateData,
      })

      res.status(200).json({
        success: true,
        message: 'แก้ไขข้อมูลเสร็จสิ้น',
        data: updatedNews,
      })
    } catch (error: any) {
      console.error('Update PR Backend Error:', error.message)
      res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลบนเซิร์ฟเวอร์',
      })
    }
  },
)

export default router
