// routes/twoFactorRoute.ts
import { Router } from 'express'
import {
  disable2FA,
  enable2FA,
  getRecoveryKeys,
  regenerateRecoveryKeys,
  requestEmailOTP,
  setup2FA,
  useRecoveryKey,
  verify2FALogin,
  verifyEmailOTPForLogin,
} from '../controllers/twoFactorController'
import authMiddleware from '../middlewares/auth'

const router = Router()

router.post('/setup', authMiddleware, setup2FA)
router.post('/enable', authMiddleware, enable2FA)
router.post('/disable', authMiddleware, disable2FA)
router.get('/recovery-keys', authMiddleware, getRecoveryKeys)
router.post('/recovery-keys/regenerate', authMiddleware, regenerateRecoveryKeys)

router.post('/otp/request', requestEmailOTP)
router.post('/otp/verify', verifyEmailOTPForLogin)

router.post('/verify-login', verify2FALogin)
router.post('/recovery/use', useRecoveryKey)

export default router
