// routes/uploadRoute.ts
import express, { Request, Response, Router } from 'express'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload' // นำเข้า multer middleware แบบ ES Modules

const router: Router = express.Router()

/**
 * @ROUTE   POST /api/upload/single
 * @DESC    1. อัปโหลดไฟล์เดียว (Single File) - คีย์ต้องชื่อว่า 'singleFile'
 */
router.post(
  '/single',
  uploadLimiter,
  upload.single('singleFile'),
  (req: Request, res: Response): any => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'กรุณาอัปโหลดไฟล์' })
      }

      res.status(200).json({
        message: 'อัปโหลดไฟล์เดียวสำเร็จ!',
        fileInfo: req.file,
      })
    } catch (error: any) {
      res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: error.message })
    }
  },
)

/**
 * @ROUTE   POST /api/upload/multiple
 * @DESC    2. อัปโหลดหลายไฟล์ (Multiple Files) - คีย์ต้องชื่อว่า 'multipleFiles' สูงสุด 5 ไฟล์
 */
router.post(
  '/multiple',
  upload.array('multipleFiles', 5),
  (req: Request, res: Response): any => {
    try {
      // กำหนด Type ให้ชัดเจนว่าเป็น Array ของ Multer File
      const files = req.files as Express.Multer.File[] | undefined

      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'กรุณาอัปโหลดอย่างน้อย 1 ไฟล์' })
      }

      res.status(200).json({
        message: 'อัปโหลดหลายไฟล์สำเร็จ!',
        filesInfo: files,
      })
    } catch (error: any) {
      res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: error.message })
    }
  },
)

export default router
