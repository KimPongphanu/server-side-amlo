// routes/authRoute.ts
import { Router } from 'express'
import {
  getMe,
  getUsers,
  heartbeat,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController'
import auth, { restrictTo } from '../middlewares/auth' // 🌟 นำเข้า restrictTo เพิ่มเข้ามา
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter'

const router = Router()

/**
 * @ROUTE   POST /api/auth/register
 * @DESC    Register a new admin user
 */
router.post(
  '/register',
  auth,
  restrictTo('ADMIN'),
  registerLimiter,
  registerUser,
)

/**
 * @ROUTE   POST /api/auth/login
 * @DESC    Authenticate user and issue JWT
 */
router.post('/login', loginLimiter, loginUser)

/**
 * @ROUTE   POST /api/auth/logout
 * @DESC    Clear cookie and blacklist the current JWT
 */
router.post('/logout', auth, logoutUser)

/**
 * @ROUTE   GET /api/auth/me
 * @DESC    Get current user profile
 */
router.get('/me', auth, getMe)

// 🌟 แก้ไขจุดนี้: ใส่ auth เพื่อตรวจ token และ restrictTo('ADMIN') เพื่อให้เฉพาะแอดมินดูรายชื่อผู้ใช้ได้
router.get('/users', auth, restrictTo('ADMIN'), getUsers)

/**
 * @ROUTE   POST /api/auth/heartbeat
 * @DESC    ยิงเพื่อบอกว่ายัง Active อยู่บนเว็บ (ยิงทุก 5 นาทีผ่าน Frontend)
 */
router.post('/heartbeat', auth, heartbeat)

export default router
