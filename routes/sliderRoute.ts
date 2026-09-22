import express, { Router } from 'express'
import {
  createSlide,
  deleteSlide,
  getAllSlides,
  reorderSlides,
} from '../controllers/sliderController'
import auth, { requireAdmin } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'

const router: Router = express.Router()

// GET /api/slider - สาธารณะ
router.get('/', getAllSlides)

// POST /api/slider - ต้องล็อกอิน (Admin/Supervisor), จำกัด rate, อัปโหลดไฟล์ก่อน
router.post('/', auth, requireAdmin, uploadLimiter, upload.single('image'), createSlide)

// PUT /api/slider/reorder - ต้องล็อกอิน (Admin/Supervisor)
router.put('/reorder', auth, requireAdmin, reorderSlides)

// DELETE /api/slider/:id - ต้องล็อกอิน (Admin/Supervisor)
router.delete('/:id', auth, requireAdmin, deleteSlide)

export default router
