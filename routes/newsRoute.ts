import express, { Router } from 'express'
import {
  createNews,
  getAllNews,
  getNews,
  updateNews,
} from '../controllers/newsController'
import auth, { requireAdmin } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'

const router: Router = express.Router()

/**
 * @ROUTE   POST /api/news
 * @DESC    สร้างข่าวสารหรือกิจกรรมใหม่ (Admin Only)
 */
router.post('/', auth, requireAdmin, uploadLimiter, upload.single('image'), createNews)

/**
 * @ROUTE   GET /api/news/all
 * @DESC    ดึงข่าวทั้งหมดรวมที่ซ่อน (Admin/Supervisor only)
 */
router.get('/all', auth, requireAdmin, getAllNews)

/**
 * @ROUTE   GET /api/news
 * @DESC    ดึงรายการข่าวที่แสดงได้เท่านั้น (Public)
 */
router.get('/', getNews)

/**
 * @ROUTE   PUT /api/news/:id
 * @DESC    อัปเดตแก้ไขข้อมูลข่าวหรือ PR ตาม ID ข้อมูล (Admin Only)
 */
router.put('/:id', auth, requireAdmin, uploadLimiter, upload.single('image'), updateNews)

export default router
