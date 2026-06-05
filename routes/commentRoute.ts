// routes/commentRoute.ts
import { Request, Response, Router } from 'express'
import prisma from '../lib/prisma'
import auth from '../middlewares/auth'
import { commentRateLimiter } from '../middlewares/rateLimiter'

const router = Router()

/**
 * @ROUTE   POST /api/comments
 * @DESC    บันทึกความคิดเห็นจากประชาชนหน้าเว็บไซต์ (Public)
 */
router.post(
  '/',
  commentRateLimiter,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { star, msg } = req.body

      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i
      if (urlRegex.test(msg)) {
        return res.status(400).json({
          success: false,
          message: 'ไม่อนุญาตให้แนบลิงก์ในความคิดเห็น',
        })
      }

      // Validation ความถูกต้องเบื้องต้นของข้อมูล
      if (star === undefined || !msg) {
        return res.status(400).json({
          success: false,
          message: 'กรุณากรอกข้อมูลคะแนนและข้อความให้ครบถ้วน',
        })
      }

      const parsedStar = parseInt(star)
      if (isNaN(parsedStar) || parsedStar < 1 || parsedStar > 5) {
        return res.status(400).json({
          success: false,
          message: 'คะแนนความพึงพอใจต้องอยู่ระหว่าง 1 ถึง 5 ดาวเท่านั้น',
        })
      }

      if (msg.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'ข้อความความคิดเห็นต้องยาวไม่เกิน 500 ตัวอักษร',
        })
      }

      // บันทึกลงฐานข้อมูล PostgreSQL ผ่าน Prisma
      const newComment = await prisma.commentItem.create({
        data: {
          star: parsedStar,
          msg: msg.trim(),
          isShow: false, // ตั้งค่าเริ่มต้นให้แสดงผลบนหน้าเว็บทันที
        },
      })

      return res.status(201).json({
        success: true,
        message: 'บันทึกความคิดเห็นสำเร็จ ขอบคุณสำหรับคำแนะนำ',
        data: newComment,
      })
    } catch (error: any) {
      console.error('Create Comment Error:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'เกิดข้อผิดพลาดภายในระบบเซิร์ฟเวอร์',
      })
    }
  },
)

/**
 * @ROUTE   GET /api/comments
 * @DESC    ดึงรายการความคิดเห็นทั้งหมด (แสดงตามเงื่อนไขของฝั่งผู้ใช้หรือ Admin)
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { all } = req.query
    const whereCondition: any = {}

    // หากไม่มีการระบุ query `all=true` (ผู้ใช้ทั่วไปดู) ให้กรองเฉพาะรายการที่ผ่านการอนุมัติให้แสดงผล
    if (all !== 'true') {
      whereCondition.isShow = true
    }

    const comments = await prisma.commentItem.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: 'desc', // แสดงความคิดเห็นล่าสุดขึ้นก่อน
      },
    })

    return res.status(200).json({
      success: true,
      data: comments,
    })
  } catch (error: any) {
    console.error('Get Comments Error:', error)
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลความคิดเห็น',
    })
  }
})

/**
 * @ROUTE   PUT /api/comments/update
 * @DESC    อัปเดตสถานะการแสดงผล (isShow) ของความคิดเห็น (สิทธิ์ Admin ในแดชบอร์ด)
 */
router.put(
  '/update',
  auth,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // 🛡️ 1. เช็คสิทธิ์ระดับกลุ่มผู้ใช้งานก่อน (Fail-Fast)
      // if (req.user?.role !== 'ADMIN') {
      //   return res
      //     .status(403)
      //     .json({ success: false, message: 'คุณไม่มีสิทธิ์ทำรายการนี้' })
      // }

      const { id, isShow } = req.body

      // 🛡️ 2. ตรวจสอบความครบถ้วนของข้อมูล Input
      if (!id || isShow === undefined) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุข้อมูลรหัสไอดีและสถานะการแสดงผลให้ครบถ้วน',
        })
      }

      // 3. อัปเดตข้อมูลลงฐานข้อมูล
      const updatedComment = await prisma.commentItem.update({
        where: { id },
        data: { isShow: !!isShow },
      })

      return res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะความคิดเห็นเรียบร้อยแล้ว',
        data: updatedComment,
      })
    } catch (error: any) {
      // 🛡️ 4. ดักจับกรณีไม่พบข้อมูล ID นี้ในระบบ (Prisma Record Not Found)
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลความคิดเห็นที่ต้องการอัปเดต',
        })
      }

      console.error('Update Comment Error:', error)
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลบนเซิร์ฟเวอร์',
      })
    }
  },
)

export default router
