// routes/contactRoute.ts
import { Request, Response, Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🌟 ดึงข้อมูลจาก req.body ออกมาเช็คให้ตรงกับชุดที่หน้าบ้านส่งมา
    const { firstName, lastName, email, telNumber, preferredContact, message } =
      req.body

    // ตรวจสอบข้อมูลจำเป็น (เบอร์โทรศัพท์ยอมให้เป็นค่าว่างได้ตามโครงสร้างหน้าบ้าน)
    if (!firstName || !lastName || !email || !preferredContact || !message) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
      })
    }

    // บันทึกลงฐานข้อมูล (คีย์ฝั่งซ้ายต้องตรงตามที่เราตั้งค่าใน Prisma Client)
    const newRequest = await prisma.contactRequest.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        // หาก telNumber ไม่มีค่า ให้บันทึกเป็น String ว่างเพื่อป้องกันค่า Null พังในเบส
        telNumber: telNumber ? String(telNumber).replace(/\s/g, '') : '',
        preferredContact,
        message: message.trim(),
      },
    })

    return res.status(201).json({
      success: true,
      message: 'บันทึกข้อความการติดต่อเรียบร้อยแล้ว',
      data: newRequest,
    })
  } catch (error: any) {
    console.error('Contact Form Error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
      errorDetail: error, // 🌟 ส่ง Error จริงกลับไปดูที่ Network tab ได้
    })
  }
})

router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const requests = await prisma.contactRequest.findMany({
      orderBy: {
        createdAt: 'desc', // ดึงข้อความใหม่ล่าสุดขึ้นก่อน
      },
    })

    return res.status(200).json({
      success: true,
      data: requests,
    })
  } catch (error) {
    console.error('Get Contact Requests Error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' })
  }
})

router.put('/update', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, status } = req.body

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูล id และสถานะให้ครบถ้วน',
      })
    }

    // ทำการอัปเดตสถานะลงใน PostgreSQL ด้วย Prisma
    const updatedRequest = await prisma.contactRequest.update({
      where: { id },
      data: { status },
    })

    return res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะข้อมูลเรียบร้อยแล้ว',
      data: updatedRequest,
    })
  } catch (error: any) {
    console.error('Update status contact error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  }
})

export default router
