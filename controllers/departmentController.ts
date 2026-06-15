import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import DOMPurify from 'isomorphic-dompurify'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

interface GalleryResponseItem {
  id: number
  type: string
  url: string
  departmentId: number
}

export const createDepartment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { ipAddress, userAgent } = getClientMetadata(req)
    const { title, content, galleryUrls } = req.body
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined

    if (!title) {
      res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' })
      return
    }
    if (title.length > 150) {
      res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' })
      return
    }
    if (!files || !files['cover_image']) {
      res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพปก (cover_image)' })
      return
    }

    const sanitizedContent = content ? DOMPurify.sanitize(content) : null

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
    ]
    const allFiles = [...files['cover_image'], ...(files['gallery'] || [])]

    for (const file of allFiles) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` })
        return
      }
    }

    const youtubeRegex =
      /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/
    const rawUrls: string[] = Array.isArray(galleryUrls)
      ? galleryUrls
      : galleryUrls
        ? [galleryUrls]
        : []

    for (const url of rawUrls) {
      if (!youtubeRegex.test(url)) {
        res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` })
        return
      }
    }

    const coverImagePath = `/uploads/${files['cover_image'][0].filename}`

    const galleryData = [
      ...(files['gallery'] || []).map((file) => ({
        url: `/uploads/${file.filename}`,
        type: file.mimetype.startsWith('video/')
          ? ('VIDEO' as const)
          : ('IMAGE' as const),
      })),
      ...rawUrls.map((url) => ({ url, type: 'VIDEO' as const })),
    ]

    const department = await prisma.department.create({
      data: {
        title,
        content: sanitizedContent,
        cover_image: coverImagePath,
        GalleryItem: { create: galleryData },
      },
      include: { GalleryItem: true },
    })

    const formattedDepartment = {
      ...department,
      gallery: department.GalleryItem.map((g: GalleryResponseItem) => ({
        ...g,
        type: g.type.toLowerCase(),
      })),
    }

    const adminUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })
    await logAudit(
      req,
      'CREATE_DEPARTMENT_SUCCESS',
      `Admin created a new department: "${title.trim()}" (Department ID: ${department.id}, Total media items: ${galleryData.length})`,
      adminUser?.id,
    )

    res
      .status(201)
      .json({ message: 'สร้างภาควิชาสำเร็จ', data: formattedDepartment })
  },
)

export const getDepartments = asyncHandler(
  async (req: Request, res: Response) => {
    const departments = await prisma.department.findMany({
      where: { isDelete: false },
      include: {
        GalleryItem: {
          select: { id: true, type: true, url: true, departmentId: true },
        },
      },
    })

    const formattedDepartments = departments.map((d: any) => ({
      ...d,
      gallery: d.GalleryItem.map((g: GalleryResponseItem) => ({
        ...g,
        type: g.type.toLowerCase(),
      })),
    }))

    res.status(200).json(formattedDepartments)
  },
)

export const deleteDepartment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params.id))
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID ไม่ถูกต้อง' })
      return
    }

    const targetDept = await prisma.department.findUnique({ where: { id } })
    if (!targetDept) {
      res.status(404).json({ message: 'ไม่พบข้อมูลหน่วยงานที่ต้องการลบ' })
      return
    }

    await prisma.department.update({
      where: { id },
      data: { isDelete: true },
    })

    const adminUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })
    await logAudit(
      req,
      'DELETE_DEPARTMENT_SUCCESS',
      `Admin performed a soft delete on department: "${targetDept.title}" (Department ID: ${id})`,
      adminUser?.id,
    )

    res.status(200).json({ message: 'ลบหน่วยงานสำเร็จ' })
  },
)

export const updateDepartment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(String(req.params.id))
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID ไม่ถูกต้อง' })
      return
    }

    const {
      title,
      content,
      galleryUrls,
      existingGalleryUrls,
      isGalleryUpdated,
    } = req.body
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined

    if (!title) {
      res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' })
      return
    }
    if (title.length > 150) {
      res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' })
      return
    }

    const existingDept = await prisma.department.findUnique({ where: { id } })
    if (!existingDept) {
      res.status(404).json({ message: 'ไม่พบหน่วยงานที่ต้องการแก้ไข' })
      return
    }

    const sanitizedContent = content ? DOMPurify.sanitize(content) : null

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
    ]
    const allFiles = [
      ...(files?.['cover_image'] || []),
      ...(files?.['gallery'] || []),
    ]
    for (const file of allFiles) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` })
        return
      }
    }

    let coverImagePath = existingDept.cover_image
    if (files?.['cover_image']) {
      coverImagePath = `/uploads/${files['cover_image'][0].filename}`
    }

    let galleryUpdateData = undefined
    if (isGalleryUpdated === 'true') {
      const youtubeRegex =
        /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/
      const rawUrls: string[] = Array.isArray(galleryUrls)
        ? galleryUrls
        : galleryUrls
          ? [galleryUrls]
          : []
      const rawExistingUrls: string[] = Array.isArray(existingGalleryUrls)
        ? existingGalleryUrls
        : existingGalleryUrls
          ? [existingGalleryUrls]
          : []

      for (const url of rawUrls) {
        if (!youtubeRegex.test(url)) {
          res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` })
          return
        }
      }

      galleryUpdateData = {
        deleteMany: {},
        create: [
          ...rawExistingUrls.map((url) => ({ url, type: 'IMAGE' as const })),
          ...(files?.['gallery'] || []).map((file) => ({
            url: `/uploads/${file.filename}`,
            type: file.mimetype.startsWith('video/')
              ? ('VIDEO' as const)
              : ('IMAGE' as const),
          })),
          ...rawUrls.map((url) => ({ url, type: 'VIDEO' as const })),
        ],
      }
    }

    const updatedDept = await prisma.department.update({
      where: { id },
      data: {
        title,
        content: sanitizedContent,
        cover_image: coverImagePath,
        ...(galleryUpdateData && { GalleryItem: galleryUpdateData }),
      },
      include: { GalleryItem: true },
    })

    const formattedDepartment = {
      ...updatedDept,
      gallery: updatedDept.GalleryItem.map((g: GalleryResponseItem) => ({
        ...g,
        type: g.type.toLowerCase(),
      })),
    }

    const adminUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })
    await logAudit(
      req,
      'UPDATE_DEPARTMENT_SUCCESS',
      `Admin updated department: "${existingDept.title}" -> "${title.trim()}" (Department ID: ${id})`,
      adminUser?.id,
    )

    res
      .status(200)
      .json({ message: 'แก้ไขหน่วยงานสำเร็จ', data: formattedDepartment })
  },
)
