// routes/departmentRoute.ts
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
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { title, content } = req.body
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined

      if (!title) {
        return res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' })
      }
      if (title.length > 150) {
        return res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' })
      }
      if (!files || !files['cover_image']) {
        return res
          .status(400)
          .json({ message: 'กรุณาอัปโหลดรูปภาพปก (cover_image)' })
      }

      // OWASP: ตรวจสอบ Mime Type ป้องกันการอัปโหลดไฟล์อันตราย
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
      ]
      const allFiles = [...files['cover_image'], ...(files['gallery'] || [])]

      for (const file of allFiles) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return res
            .status(400)
            .json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` })
        }
      }

      const coverImagePath = `/uploads/${files['cover_image'][0].filename}`
      const galleryData = (files['gallery'] || []).map((file) => ({
        url: `/uploads/${file.filename}`,
        type: file.mimetype.startsWith('video/')
          ? ('VIDEO' as const)
          : ('IMAGE' as const),
      }))

      // บันทึกข้อมูลแบบ Relation ในครั้งเดียว
      const department = await prisma.department.create({
        data: {
          title,
          content,
          cover_image: coverImagePath,
          gallery: {
            create: galleryData,
          },
        },
        include: {
          gallery: true,
        },
      })

      res.status(201).json({ message: 'สร้างภาควิชาสำเร็จ', data: department })
    } catch (error: any) {
      console.error('Create Department Error:', error.message)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
    }
  },
)

router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        gallery: {
          select: {
            type: true,
            url: true,
          },
        },
      },
    })

    res.status(200).json(departments)
  } catch (error: any) {
    console.error('Get Departments Error:', error.message)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
  }
})

export default router
