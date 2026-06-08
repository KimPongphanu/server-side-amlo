// routes/authRoute.ts
import { Router } from 'express'
import {
  getMe,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController'
import auth from '../middlewares/auth'
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter'

const router = Router()

/**
 * @ROUTE   POST /api/auth/register
 * @DESC    Register a new admin user
 */
router.post('/register', registerLimiter, registerUser)

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

export default router
