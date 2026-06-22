import express, { Router } from 'express'
import {
  createPopup,
  deletePopup,
  getActivePopup,
  getAllPopups,
  updatePopup,
} from '../controllers/splashPopupController'
import auth, { requireSupervisor } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'
import { logAudit } from '../utils/auditLogger'

const router: Router = express.Router()

// GET /api/splash-popups/active — สาธารณะ (ต้องมาก่อน /:id)
router.get('/active', getActivePopup)

// GET /api/splash-popups — admin
router.get('/', auth, requireSupervisor, getAllPopups)

// POST /api/splash-popups — admin + upload
router.post(
  '/',
  auth,
  requireSupervisor,
  uploadLimiter,
  upload.single('image'),
  async (req, res, next) => {
    const userId = (req as any).user?.id ?? null
    await logAudit(
      req,
      'CREATE_SPLASH_POPUP',
      `สร้าง Popup${req.body.title ? `: ${req.body.title}` : ''}`,
      userId,
    )
    next()
  },
  createPopup,
)

// PUT /api/splash-popups/:id — admin
router.put(
  '/:id',
  auth,
  requireSupervisor,
  async (req, res, next) => {
    const userId = (req as any).user?.id ?? null
    const isActive = req.body.isActive
    await logAudit(
      req,
      'UPDATE_SPLASH_POPUP',
      `อัปเดต Popup #${req.params.id}${isActive !== undefined ? ` isActive=${isActive}` : ''}`,
      userId,
    )
    next()
  },
  updatePopup,
)

// DELETE /api/splash-popups/:id — admin
router.delete(
  '/:id',
  auth,
  requireSupervisor,
  async (req, res, next) => {
    const userId = (req as any).user?.id ?? null
    await logAudit(
      req,
      'DELETE_SPLASH_POPUP',
      `ลบ Popup #${req.params.id}`,
      userId,
    )
    next()
  },
  deletePopup,
)

export default router
