import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

export const createComment = asyncHandler(
  async (req: Request, res: Response) => {
    // 🌟 2. ดักดึง IP Address และ User Agent ของประชาชนที่ส่งฟอร์มเข้ามาก่อน
    const { ipAddress, userAgent } = getClientMetadata(req)

    const { star, msg } = req.body

    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i
    if (urlRegex.test(msg)) {
      res.status(400).json({
        success: false,
        message: 'ไม่อนุญาตให้แนบลิงก์ในความคิดเห็น',
      })
      return
    }

    // Validation ความถูกต้องเบื้องต้นของข้อมูล
    if (star === undefined || !msg) {
      res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลคะแนนและข้อความให้ครบถ้วน',
      })
      return
    }

    const parsedStar = parseInt(star)
    if (isNaN(parsedStar) || parsedStar < 1 || parsedStar > 5) {
      res.status(400).json({
        success: false,
        message: 'คะแนนความพึงพอใจต้องอยู่ระหว่าง 1 ถึง 5 ดาวเท่านั้น',
      })
      return
    }

    if (msg.length > 500) {
      res.status(400).json({
        success: false,
        message: 'ข้อความความคิดเห็นต้องยาวไม่เกิน 500 ตัวอักษร',
      })
      return
    }

    // บันทึกความคิดเห็นลงฐานข้อมูล PostgreSQL ผ่าน Prisma
    const newComment = await prisma.commentItem.create({
      data: {
        star: parsedStar,
        msg: msg.trim(),
        isShow: parsedStar >= 4,
      },
    })

    await logAudit(
      req,
      'CREATE_COMMENT_SUCCESS',
      `Public comment submitted successfully (Rating: ${parsedStar} stars, Comment ID: ${newComment.id})`,
      null,
    )

    res.status(201).json({
      success: true,
      message: 'บันทึกความคิดเห็นสำเร็จ ขอบคุณสำหรับคำแนะนำ',
      data: newComment,
    })
  },
)

export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const { all } = req.query
  const whereCondition: any = {}

  if (all !== 'true') {
    whereCondition.isShow = true
  }

  const comments = await prisma.commentItem.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: 'desc',
    },
  })

  res.status(200).json({
    success: true,
    data: comments,
  })
})

export const updateComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { id, isShow } = req.body

    if (!id || isShow === undefined) {
      res.status(400).json({
        success: false,
        message: 'กรุณาระบุข้อมูลรหัสไอดีและสถานะการแสดงผลให้ครบถ้วน',
      })
      return
    }

    // จัดการ Error กรณีไม่พบ ID (P2025) ได้ด้วย Global Error Handler ในอนาคต
    const updatedComment = await prisma.commentItem.update({
      where: { id },
      data: { isShow: !!isShow },
    })

    res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะความคิดเห็นเรียบร้อยแล้ว',
      data: updatedComment,
    })
  },
)
