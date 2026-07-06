import { Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { sendEmail } from '../services/emailService'
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
    const recentContact = await prisma.contact_requests.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        created_at: {
          gt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
        }
      }
    })

    if (recentContact) {
      res.status(429).json({
        success: false,
        message: 'คุณส่งข้อความติดต่อถี่เกินไป กรุณารอ 2 นาทีแล้วลองใหม่อีกครั้ง'
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
        updated_at: new Date(),
      },
    })

    await logAudit(
      req,
      'CREATE_CONTACT_SUCCESS',
      `Public contact form submitted successfully (Name: ${first_name.trim()} ${last_name.trim()}, Email: ${email.trim().toLowerCase()}, Request ID: ${newRequest.id})`,
      null,
    )

    // ─── ส่งอีเมลแจ้งเตือนไปหา Supervisor ทุกคน ───
    try {
      const supervisors = await prisma.user.findMany({
        where: { role: 'SUPERVISOR' },
        select: { email: true },
      })

      if (supervisors.length > 0) {
        const createdAt = new Date().toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        const emailHtml = `
<table align="center" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
  <tr>
    <td style="background:linear-gradient(135deg,#185FA5,#134b82);padding:32px 30px 24px;text-align:center">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/>
      </svg>
      <h1 style="color:#ffffff;font-size:18px;font-weight:700;margin:8px 0 0">คําร้องติดต่อใหม่จากเว็บไซต์</h1>
      <p style="color:rgba(255,255,255,0.75);font-size:12px;margin:5px 0 0">สํานักงานป้องกันและปราบปรามการฟอกเงิน (ปปง.)</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 30px 0">
      <p style="color:#334155;font-size:14px;margin:0 0 4px;font-weight:600">สวัสดี ผู้ดูแลระบบ,</p>
      <p style="color:#64748b;font-size:13px;margin:0 0 20px">มีผู้ส่งคําร้องติดต่อใหม่ผ่านเว็บไซต์ รายละเอียดดังนี้</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td colspan="2" style="background:#f8fafc;padding:9px 16px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">รายละเอียดผู้ติดต่อ</td></tr>
        <tr><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;width:110px;font-size:13px;font-weight:600;color:#475569;background:#fafafa">ชื่อ-นามสกุล</td><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500">${first_name} ${last_name}</td></tr>
        <tr><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#475569;background:#fafafa">อีเมล</td><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b"><a href="mailto:${email}" style="color:#185FA5;text-decoration:none;font-weight:500">${email}</a></td></tr>
        <tr><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#475569;background:#fafafa">เบอร์โทรศัพท์</td><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${tel_number}</td></tr>
        <tr><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#475569;background:#fafafa">ช่องทางติดต่อ</td><td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b"><span style="display:inline-block;background:#e0f2fe;color:#0369a1;font-size:11px;font-weight:600;padding:3px 12px;border-radius:20px">${preferred_contact}</span></td></tr>
        <tr><td colspan="2" style="background:#f8fafc;padding:9px 16px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">ข้อความ</td></tr>
        <tr><td colspan="2" style="padding:14px 16px;font-size:13px;color:#334155;line-height:1.7;background:#fafafa;font-style:italic">"${message}"</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 30px 0">
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:8px;padding:10px 14px">
        <tr><td style="font-size:11px;color:#94a3b8"><span>${createdAt}</span><span style="margin:0 6px;color:#cbd5e1">|</span><span>IP: ${ipAddress}</span></td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 30px 0"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0"></td>
  </tr>
  <tr>
    <td style="padding:16px 30px 24px;text-align:center">
      <p style="color:#94a3b8;font-size:10px;margin:0;line-height:1.6">สํานักงานป้องกันและปราบปรามการฟอกเงิน (ปปง.)<br>90 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310<br>อีเมลนี้ถูกส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ</p>
      <p style="color:#cbd5e1;font-size:9px;margin:8px 0 0">แจ้งเตือนอัตโนมัติจากระบบจัดการเว็บไซต์ ปปง.</p>
    </td>
  </tr>
</table>`

        for (const sup of supervisors) {
          await sendEmail({
            to: sup.email,
            subject: `คําร้องติดต่อใหม่จาก ${first_name} ${last_name}`,
            html: emailHtml,
          }).catch(() => {})
        }
        console.log(
          `[Contact] Email sent to ${supervisors.length} supervisor(s)`,
        )
      }
    } catch (emailErr) {
      console.error('[Contact] Failed to send notification email:', emailErr)
    }

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

    const mappedRequests = requests.map((item: (typeof requests)[0]) => ({
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      email: item.email,
      telNumber: item.tel_number,
      preferredContact: item.preferred_contact,
      message: item.message,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))

    res.status(200).json({
      success: true,
      data: mappedRequests,
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
