// routes/twoFactorRoute.ts
import { Router } from 'express'
import {
  disable2FA,
  enable2FA,
  getRecoveryKeys,
  regenerateRecoveryKeys,
  setup2FA,
  useRecoveryKey,
  verify2FALogin,
} from '../controllers/twoFactorController'
import authMiddleware from '../middlewares/auth'
import { verifyLimiter } from '../middlewares/rateLimiter'

const router = Router()

// 🌟 enrollment เป็นประตูหลักของบัญชี admin แล้ว — ต้องมี rate limit กัน brute force TOTP
router.post('/setup', authMiddleware, verifyLimiter, setup2FA)
router.post('/enable', authMiddleware, verifyLimiter, enable2FA)
router.post('/disable', authMiddleware, verifyLimiter, disable2FA)
router.get('/recovery-keys', authMiddleware, getRecoveryKeys)
router.post('/recovery-keys/regenerate', authMiddleware, verifyLimiter, regenerateRecoveryKeys)

router.post('/verify-login', verifyLimiter, verify2FALogin)
router.post('/recovery/use', verifyLimiter, useRecoveryKey)

export default router
