// middlewares/upload.ts
import { Request } from 'express'
import fs from 'fs'
import multer, { StorageEngine } from 'multer'
import path from 'path'

const uploadDir: string = 'uploads/'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(
      null,
      file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname),
    )
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัด 5MB

  // 🌟 เพิ่มฟังก์ชันดักจับประเภทไฟล์ที่นี่ (ปราการด่านแรก)
  fileFilter: (req: Request, file: Express.Multer.File, cb: any) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
    ]

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('ไฟล์ประเภทนี้ไม่ได้รับอนุญาตให้สะสมในระบบ'), false)
    }
    cb(null, true)
  },
})

export default upload
