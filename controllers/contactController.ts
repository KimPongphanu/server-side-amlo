import { Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

export const createContact = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    // 🌟 ดักดึง IP Address และ User Agent ของผู้ส่งฟอร์มก่อน
    const { ipAddress, userAgent } = getClientMetadata(req)

    // Support both camelCase (from frontend) and snake_case (from API clients)
    const first_name = req.body.first_name || req.body.firstName
    const last_name = req.body.last_name || req.body.lastName
    const email = req.body.email
    const tel_number = req.body.tel_number || req.body.telNumber
    const preferred_contact =
      req.body.preferred_contact || req.body.preferredContact
    const message = req.body.message

    if (!first_name || !last_name || !email || !preferred_contact || !message) {
      res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน',
      })
      return
    }

    // บันทึกลงฐานข้อมูล
    const newRequest = await prisma.contact_requests.create({
      data: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        tel_number: tel_number ? String(tel_number).replace(/\s/g, '') : '',
        preferred_contact,
        message: message.trim(),
      },
    })

    await logAudit(
      req,
      'CREATE_CONTACT_SUCCESS',
      `Public contact form submitted successfully (Name: ${first_name.trim()} ${last_name.trim()}, Email: ${email.trim().toLowerCase()}, Request ID: ${newRequest.id})`,
      null,
    )

    res.status(201).json({
      success: true,
      message: 'บันทึกข้อความการติดต่อเรียบร้อยแล้ว',
      data: newRequest,
    })
  },
)

export const getContactRequests = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const requests = await prisma.contact_requests.findMany({
      orderBy: {
        created_at: 'desc',
      },
    })

    res.status(200).json({
      success: true,
      data: requests,
    })
  },
)

export const updateContactStatus = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    // 🌟 ดักดึง IP Address และ User Agent ของเจ้าหน้าที่ระบบ
    const { ipAddress, userAgent } = getClientMetadata(req)

    const { id, status } = req.body

    if (!id || !status) {
      res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูล id และสถานะให้ครบถ้วน',
      })
      return
    }

    // ตรวจสอบข้อมูลก่อนแก้ไขเพื่อเก็บ Log ข้อมูลเดิม
    const oldRequest = await prisma.contact_requests.findUnique({
      where: { id },
    })
    if (!oldRequest) {
      res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลรายการติดต่อที่ต้องการอัปเดต',
      })
      return
    }

    // ดึงรหัสไอดีของแอดมินผู้ประมวลผลผ่านข้อมูล Token จาก Middleware
    const adminUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    // ทำการอัปเดตสถานะลงใน PostgreSQL ด้วย Prisma
    const updatedRequest = await prisma.contact_requests.update({
      where: { id },
      data: { status },
    })

    await logAudit(
      req,
      'UPDATE_CONTACT_STATUS_SUCCESS',
      `Admin updated contact request status (Request ID: ${id}, Old status: "${oldRequest.status}", New status: "${status}")`,
      adminUser?.id,
    )

    res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะข้อมูลเรียบร้อยแล้ว',
      data: updatedRequest,
    })
  },
)
