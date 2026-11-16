import express, { Router } from 'express'
import {
  getAllSettings,
  updateSettings,
  retryTranslation,
} from '../controllers/footerSettingController'
import auth, { requireAdmin } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'

const router: Router = express.Router()

// GET /api/settings — สาธารณะ
router.get('/', getAllSettings)

// PUT /api/settings — admin เท่านั้น + audit
router.put(
  '/',
  auth,
  requireAdmin,
  async (req, res, next) => {
    const userId = (req as any).user?.id ?? null
    await logAudit(
      req,
      'UPDATE_SITE_SETTINGS',
      'อัปเดตการตั้งค่าเว็บไซต์ (Footer, นโยบาย ฯลฯ)',
      userId,
    )
    next()
  },
  updateSettings,
)

// POST /api/settings/retry-translation — รีทรายคำแปล (admin เท่านั้น)
router.post(
  '/retry-translation',
  auth,
  retryTranslation,
)

export default router
