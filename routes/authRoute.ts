// routes/authRoute.ts
import bcrypt from 'bcryptjs'
import express, { Request, Response, Router } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma' // ดึงมาจากไฟล์ตัวกลาง (.ts หรือ .js)
import auth from '../middlewares/auth'
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter'

const router: Router = express.Router()

/**
 * @ROUTE   POST /api/auth/register
 */
router.post(
  '/register',
  registerLimiter,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password, firstname, lastname } = req.body

      // 1. ตรวจสอบความถูกต้องและความยาวข้อมูล (Input Validation & Length Limiting)
      if (!email || !password || !firstname || !lastname) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
      }

      // ดักจับข้อมูลที่ยาวเกินไปเพื่อป้องกัน ReDoS และ Memory Exhaustion
      if (
        email.length > 100 ||
        password.length > 100 ||
        firstname.length > 50 ||
        lastname.length > 50
      ) {
        return res.status(400).json({ message: 'ข้อมูลมีความยาวเกินกำหนด' })
      }

      // ตรวจสอบรูปแบบ Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' })
      }

      // ตรวจสอบความแข็งแกร่งของรหัสผ่าน
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/
      if (!strongPasswordRegex.test(password)) {
        return res.status(400).json({
          message:
            'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข อย่างน้อยอย่างละ 1 ตัว',
        })
      }

      // 2. ตรวจสอบบัญชีซ้ำ
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        // สำหรับแอปทั่วไปส่งแบบนี้ได้ (UX ดี) แต่ถ้าแอปความปลอดภัยสูงมากให้ใช้คำกลางๆ เพื่อป้องกัน User Enumeration
        return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' })
      }

      // 3. เข้ารหัสข้อมูลและบันทึก
      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, firstname, lastname },
      })

      // 4. ส่งค่ากลับอย่างปลอดภัย (ซ่อน Internal Database ID)
      res.status(201).json({
        message: 'สมัครสมาชิกสำเร็จ',
        userRef: user.uuid,
      })
    } catch (error: any) {
      // โยนข้อความ Error จริงเข้า Log ระบบหลังบ้าน เพื่อไม่ให้แฮกเกอร์เห็นโครงสร้างระบบผ่าน Error Message หน้าบ้าน
      console.error('Register Error Logged:', error.message)

      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
    }
  },
)

/**
 * @ROUTE   POST /api/auth/login
 */
router.post(
  '/login',
  loginLimiter,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body

      // 1. ดักกรองความถูกต้องและความยาวสูงสุดเพื่อป้องกันภัยคุกคาม
      if (!email || !password) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
      }
      if (email.length > 100 || password.length > 100) {
        return res.status(400).json({ message: 'ข้อมูลมีความยาวเกินกำหนด' })
      }

      // 2. ตรวจสอบข้อมูลบัญชีผู้ใช้งาน
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
      }

      // 3. ตรวจสอบค่าคอนฟิกระบบลับ
      const secret = process.env.JWT_SECRET
      if (!secret) {
        console.error('JWT Secret configuration missing!')
        return res
          .status(500)
          .json({ message: 'เกิดข้อผิดพลาดในการตั้งค่าระบบ' })
      }

      // 4. สร้างสิทธิ์ยืนยันตัวตน
      const token = jwt.sign(
        {
          uuid: user.uuid,
          email: user.email,
          firstName: user.firstname,
          lastName: user.lastname,
        },
        secret,
        {
          expiresIn: '1d',
        },
      )

      // 5. ส่ง Token ผ่าน HTTP-Only Cookie แทนการส่งออกไปใน Body
      res.cookie('token', token, {
        httpOnly: true, // 🔒 ป้องกันไม่ให้ JavaScript (Frontend) เข้าถึงหรืออ่านค่าได้
        secure: process.env.NODE_ENV === 'production', //เปิดใช้งานเฉพาะ HTTPS บน Production (บน localhost จะเป็น false ให้ทำงานได้ปกติ)
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      })

      // 6. ส่งกลับเฉพาะข้อมูลสถานะความสำเร็จ (ไม่ต้องแนบ token ไปใน JSON แล้ว)
      res.status(200).json({
        message: 'เข้าสู่ระบบสำเร็จ',
        success: true,
        user: {
          uuid: user.uuid,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: 'Admin',
        },
      })
    } catch (error: any) {
      // บันทึกความผิดพลาดลง Log หลังบ้านเพื่อความปลอดภัย
      console.error('Login Error Logged:', error.message)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
    }
  },
)

router.post('/logout', (req: Request, res: Response) => {
  // สั่งสั่งทำลาย Cookie สิทธิ์การเข้าถึงออกจากเครื่องเบราว์เซอร์ทันที
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })

  res.status(200).json({ success: true, message: 'ออกจากระบบสำเร็จ' })
})

router.get('/online', (req: Request, res: Response) => {
  try {
    return res.status(200).json({ message: 'Server is online!' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @ROUTE   GET /api/auth/me
 */
router.get('/me', auth, async (req: any, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({
      where: { uuid: req.user.uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstname: true,
        lastname: true,
        createdAt: true,
        recentOnline: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบัญชีผู้ใช้งานในระบบ',
      })
    }

    // 🌟 ส่งสถานะ success: true และแพ็คข้อมูล user กลับไปให้หน้าบ้านเช็คเงื่อนไขได้ถูกต้อง
    res.status(200).json({
      success: true,
      user: {
        ...user,
        role: 'Admin',
      },
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดภายในระบบ',
    })
  }
})

export default router
