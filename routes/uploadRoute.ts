// routes/uploadRoute.ts
import express, { Request, Response, Router } from 'express'
import asyncHandler from 'express-async-handler'
import fs from 'fs'
import auth, { requireAdmin } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'
import { validateMagicBytes } from '../utils/fileValidator'
import {
  convertUploadToWebp,
  convertUploadsToWebp,
} from '../utils/imageProcessing'

const router: Router = express.Router()

// 🌟 ตรวจ magic bytes ของทุกไฟล์ — content ไม่ตรงกับ MIME ที่อนุญาต = ลบไฟล์ทิ้งทั้งหมด
const validateAndCleanup = async (
  files: Express.Multer.File[],
): Promise<string | null> => {
  let allValid = true
  for (const file of files) {
    const valid = await validateMagicBytes(file.path, file.mimetype)
    if (!valid) allValid = false
  }

  if (!allValid) {
    for (const file of files) {
      try {
        fs.unlinkSync(file.path)
      } catch {
        // ignore cleanup errors
      }
    }
    return 'เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่อนุญาต (ตรวจสอบ magic bytes ไม่ผ่าน)'
  }
  return null
}

/**
 * @ROUTE   POST /api/upload/single
 * @DESC    1. อัปโหลดไฟล์เดียว (Single File) - คีย์ต้องชื่อว่า 'singleFile'
 * @ACCESS  Admin/Supervisor only + magic bytes validation
 */
router.post(
  '/single',
  auth,
  requireAdmin,
  uploadLimiter,
  upload.single('singleFile'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: 'กรุณาอัปโหลดไฟล์' })
      return
    }

    const error = await validateAndCleanup([req.file])
    if (error) {
      res.status(400).json({ success: false, message: error })
      return
    }

    // 🌟 แปลงเป็น WebP (ตัด EXIF + จำกัดด้านยาว) ก่อนส่งข้อมูลไฟล์กลับ
    await convertUploadToWebp(req.file)

    res.status(200).json({
      message: 'อัปโหลดไฟล์เดียวสำเร็จ!',
      fileInfo: req.file,
    })
  }),
)

/**
 * @ROUTE   POST /api/upload/multiple
 * @DESC    2. อัปโหลดหลายไฟล์ (Multiple Files) - คีย์ต้องชื่อว่า 'multipleFiles' สูงสุด 5 ไฟล์
 * @ACCESS  Admin/Supervisor only + magic bytes validation
 */
router.post(
  '/multiple',
  auth,
  requireAdmin,
  uploadLimiter,
  upload.array('multipleFiles', 5),
  asyncHandler(async (req: Request, res: Response) => {
    // กำหนด Type ให้ชัดเจนว่าเป็น Array ของ Multer File
    const files = req.files as Express.Multer.File[] | undefined

    if (!files || files.length === 0) {
      res.status(400).json({ message: 'กรุณาอัปโหลดอย่างน้อย 1 ไฟล์' })
      return
    }

    const error = await validateAndCleanup(files)
    if (error) {
      res.status(400).json({ success: false, message: error })
      return
    }

    // 🌟 แปลงเป็น WebP (ตัด EXIF + จำกัดด้านยาว) ก่อนส่งข้อมูลไฟล์กลับ
    await convertUploadsToWebp(files)

    res.status(200).json({
      message: 'อัปโหลดหลายไฟล์สำเร็จ!',
      filesInfo: files,
    })
  }),
)

export default router
