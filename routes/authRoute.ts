// routes/authRoute.ts
import { Router } from 'express'
import {
  banUser,
  deleteUser,
  getMe,
  getUsers,
  heartbeat,
  loginUser,
  logoutUser,
  registerUser,
  unbanUser,
} from '../controllers/authController'
import {
  forceResetUserPassword,
  resendForceResetOTP,
  sendForceResetOTP,
  verifyForceResetOTP,
} from '../controllers/forceResetController'
import { resetPassword } from '../controllers/passwordResetController'
import auth, { requireSupervisor } from '../middlewares/auth'
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter'

const router = Router()

/**
 * @ROUTE   POST /api/auth/register
 * @DESC    Register a new admin user (Supervisor only)
 */
router.post('/register', auth, requireSupervisor, registerLimiter, registerUser)

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

/**
 * @ROUTE   GET /api/auth/users
 * @DESC    Get all users (Supervisor only)
 */
router.get('/users', auth, requireSupervisor, getUsers)

/**
 * @ROUTE   PUT /api/auth/users/:uuid/ban
 * @DESC    Ban a user with 3-step confirmation (Supervisor only)
 */
router.put('/users/:uuid/ban', auth, requireSupervisor, banUser)

/**
 * @ROUTE   PUT /api/auth/users/:uuid/unban
 * @DESC    Unban a user with 3-step confirmation (Supervisor only)
 */
router.put('/users/:uuid/unban', auth, requireSupervisor, unbanUser)

/**
 * @ROUTE   DELETE /api/auth/users/:uuid
 * @DESC    Delete a user with 3-step confirmation (Supervisor only)
 */
router.delete('/users/:uuid', auth, requireSupervisor, deleteUser)

/**
 * @ROUTE   POST /api/auth/heartbeat
 * @DESC    อัปเดตสถานะออนไลน์ (ยิงทุก 5 นาที)
 */
router.post('/heartbeat', auth, heartbeat)

/**
 * @ROUTE   POST /api/auth/reset-password
 * @DESC    Reset password using OTP or reset token
 */
router.post('/reset-password', resetPassword)

// ──────────────────────────────────────────────────────
// SUPERVISOR FORCE RESET PASSWORD ROUTES
// ──────────────────────────────────────────────────────

/**
 * @ROUTE   POST /api/auth/users/:uuid/force-reset
 * @DESC    Supervisor forces a user to reset password on next login
 * @ACCESS  Supervisor only
 */
router.post(
  '/users/:uuid/force-reset',
  auth,
  requireSupervisor,
  forceResetUserPassword,
)

/**
 * @ROUTE   POST /api/auth/force-reset/send-otp
 * @DESC    Send OTP to user email for force reset (called on mount)
 * @ACCESS  Authenticated
 */
router.post('/force-reset/send-otp', auth, sendForceResetOTP)

/**
 * @ROUTE   POST /api/auth/force-reset/resend-otp
 * @DESC    Resend OTP (invalidates old one)
 * @ACCESS  Authenticated
 */
router.post('/force-reset/resend-otp', auth, resendForceResetOTP)

/**
 * @ROUTE   POST /api/auth/force-reset/verify
 * @DESC    Verify OTP + set new password, clears forcePasswordReset flag
 * @ACCESS  Authenticated
 */
router.post('/force-reset/verify', auth, verifyForceResetOTP)

export default router
