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
      const { title, content, galleryUrls } = req.body
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

      // ตรวจสอบและรวบรวม YouTube URLs
      const youtubeRegex =
        /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/
      const rawUrls: string[] = Array.isArray(galleryUrls)
        ? galleryUrls
        : galleryUrls
        ? [galleryUrls]
        : []

      for (const url of rawUrls) {
        if (!youtubeRegex.test(url)) {
          return res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` })
        }
      }

      const coverImagePath = `/uploads/${files['cover_image'][0].filename}`

      // รวม Gallery จากไฟล์อัปโหลด + YouTube URL
      const galleryData = [
        ...(files['gallery'] || []).map((file) => ({
          url: `/uploads/${file.filename}`,
          type: file.mimetype.startsWith('video/')
            ? ('VIDEO' as const)
            : ('IMAGE' as const),
        })),
        ...rawUrls.map((url) => ({
          url,
          type: 'VIDEO' as const,
        })),
      ]

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

      const formattedDepartment = {
        ...department,
        gallery: department.gallery.map(g => ({
          ...g,
          type: g.type.toLowerCase()
        }))
      }

      res.status(201).json({ message: 'สร้างภาควิชาสำเร็จ', data: formattedDepartment })
    } catch (error: any) {
      console.error('Create Department Error:', error.message)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
    }
  },
)

router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const departments = await prisma.department.findMany({
      where: {
        isDelete: false,
      },
      include: {
        gallery: {
          select: {
            type: true,
            url: true,
          },
        },
      },
    })

    const formattedDepartments = departments.map((d) => ({
      ...d,
      gallery: d.gallery.map((g) => ({
        ...g,
        type: g.type.toLowerCase(),
      })),
    }))

    res.status(200).json(formattedDepartments)
  } catch (error: any) {
    console.error('GET DEPARTMENTS FATAL ERROR:', error)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ', message: error?.message, stack: error?.stack })
  }
})


router.delete('/:id', auth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID ไม่ถูกต้อง' })
    }

    // Soft delete จะทำการซ่อนข้อมูลแทนการลบออกจาก Database จริงๆ
    await prisma.department.update({
      where: { id },
      data: { isDelete: true },
    })

    res.status(200).json({ message: 'ลบหน่วยงานสำเร็จ' })
  } catch (error: any) {
    console.error('Delete Department Error:', error.message)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' })
  }
})

router.put(
  '/:id',
  auth,
  uploadLimiter,
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const id = parseInt(req.params.id)
      if (isNaN(id)) return res.status(400).json({ message: 'ID ไม่ถูกต้อง' })

      const { title, content, galleryUrls, existingGalleryUrls, isGalleryUpdated } = req.body
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

      if (!title) return res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' })
      if (title.length > 150) return res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' })

      const existingDept = await prisma.department.findUnique({ where: { id } })
      if (!existingDept) return res.status(404).json({ message: 'ไม่พบหน่วยงานที่ต้องการแก้ไข' })

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
      const allFiles = [...(files?.['cover_image'] || []), ...(files?.['gallery'] || [])]
      
      for (const file of allFiles) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` })
        }
      }

      let coverImagePath = existingDept.cover_image
      if (files?.['cover_image']) {
        coverImagePath = `/uploads/${files['cover_image'][0].filename}`
      }

      // ถ้ามีการส่งไฟล์ gallery หรือ galleryUrls มาใหม่ ให้ลบของเก่าแล้วสร้างใหม่
      let galleryUpdateData = undefined
      if (isGalleryUpdated === 'true') {
        const youtubeRegex = /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/
        const rawUrls: string[] = Array.isArray(galleryUrls) ? galleryUrls : galleryUrls ? [galleryUrls] : []
        const rawExistingUrls: string[] = Array.isArray(existingGalleryUrls) ? existingGalleryUrls : existingGalleryUrls ? [existingGalleryUrls] : []

        for (const url of rawUrls) {
          if (!youtubeRegex.test(url)) return res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` })
        }

        const newGalleryData = [
          ...rawExistingUrls.map((url) => ({
            url,
            type: 'IMAGE' as const,
          })),
          ...(files?.['gallery'] || []).map((file) => ({
            url: `/uploads/${file.filename}`,
            type: file.mimetype.startsWith('video/') ? ('VIDEO' as const) : ('IMAGE' as const),
          })),
          ...rawUrls.map((url) => ({
            url,
            type: 'VIDEO' as const,
          }))
        ]

        galleryUpdateData = {
          deleteMany: {}, // ลบของเดิมทั้งหมด
          create: newGalleryData, // ใส่ของใหม่
        }
      }

      const updatedDept = await prisma.department.update({
        where: { id },
        data: {
          title,
          content,
          cover_image: coverImagePath,
          ...(galleryUpdateData && { gallery: galleryUpdateData })
        },
        include: { gallery: true },
      })

      const formattedDepartment = {
        ...updatedDept,
        gallery: updatedDept.gallery.map(g => ({
          ...g,
          type: g.type.toLowerCase()
        }))
      }

      res.status(200).json({ message: 'แก้ไขหน่วยงานสำเร็จ', data: formattedDepartment })
    } catch (error: any) {
      console.error('Update Department Error:', error.message)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' })
    }
  }
)

export default router
