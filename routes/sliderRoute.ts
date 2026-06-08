// routes/sliderRoute.ts
import express, { Request, Response, Router } from 'express'
import prisma from '../lib/prisma'
import auth from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'

const router: Router = express.Router()

// ── GET /api/slider  → ดึงรายการสไลด์ทั้งหมด (เรียงตาม order) ──
router.get('/', async (_req: Request, res: Response): Promise<any> => {
  try {
    const slides = await prisma.sliderImage.findMany({
      orderBy: { order: 'asc' },
    })
    res.status(200).json({ success: true, data: slides })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message })
  }
})

// ── POST /api/slider  → เพิ่มรูปภาพใหม่ (ต้องล็อกอิน) ──
router.post(
  '/',
  auth,
  uploadLimiter,
  upload.single('image'),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const file = req.file
      if (!file) {
        return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดรูปภาพ' })
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น' })
      }

      // หาลำดับสูงสุดปัจจุบัน
      const maxOrder = await prisma.sliderImage.aggregate({ _max: { order: true } })
      const nextOrder = (maxOrder._max.order ?? -1) + 1

      const newSlide = await prisma.sliderImage.create({
        data: {
          image_url: `/uploads/${file.filename}`,
          order: nextOrder,
        },
      })

      res.status(201).json({ success: true, data: newSlide })
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message })
    }
  },
)

// ── PUT /api/slider/reorder  → บันทึกลำดับใหม่ทั้งหมด ──
router.put('/reorder', auth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderedIds } = req.body as { orderedIds: number[] }

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'ข้อมูลลำดับไม่ถูกต้อง' })
    }

    // อัปเดต order ของแต่ละรายการ
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.sliderImage.update({
          where: { id },
          data: { order: index },
        }),
      ),
    )

    res.status(200).json({ success: true, message: 'บันทึกลำดับสำเร็จ' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message })
  }
})

// ── DELETE /api/slider/:id  → ลบสไลด์ (ต้องล็อกอิน) ──
router.delete('/:id', auth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' })
    }

    await prisma.sliderImage.delete({ where: { id } })

    res.status(200).json({ success: true, message: 'ลบสไลด์สำเร็จ' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message })
  }
})

export default router


