import express, { NextFunction, Request, Response, Router } from 'express'
import {
  createBanner,
  deleteBanner,
  getAllBanners,
  getAllBannersAdmin,
  reorderBanners,
  toggleBannerVisibility,
  updateBanner,
} from '../controllers/bannerController'
import auth, { requireAdmin } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'
import { logAudit } from '../utils/auditLogger'

const router: Router = express.Router()

// Audit log middleware for authenticated routes
const audit =
  (action: string, getDetails: (req: Request) => string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id ?? null
    await logAudit(req, action, getDetails(req), userId)
    next()
  }

// GET /api/banners/all — 🌟 Admin/Supervisor only (ดูรวมที่ซ่อน) — ต้องอยู่บน /:id routes
router.get('/all', auth, requireAdmin, getAllBannersAdmin)

// GET /api/banners — สาธารณะ (เฉพาะ isShow=true เสมอ)
router.get('/', getAllBanners)

// POST /api/banners — ต้องล็อกอิน (Admin/Supervisor) + rate limit + audit
router.post(
  '/',
  auth,
  requireAdmin,
  uploadLimiter,
  upload.single('image'),
  audit(
    'CREATE_BANNER',
    (req) => `เพิ่ม Banner${req.body.title ? `: ${req.body.title}` : ''}`,
  ),
  createBanner,
)

// PUT /api/banners/reorder — ต้องล็อกอิน (Admin/Supervisor) + audit
router.put(
  '/reorder',
  auth,
  requireAdmin,
  audit(
    'REORDER_BANNERS',
    (req) => `จัดลำดับ Banner ใหม่: ${JSON.stringify(req.body.orderedIds)}`,
  ),
  reorderBanners,
)

// PUT /api/banners/:id — อัปเดต title และ link_url (Admin/Supervisor) + audit
router.put(
  '/:id',
  auth,
  requireAdmin,
  audit(
    'UPDATE_BANNER',
    (req) =>
      `แก้ไข Banner #${req.params.id}${req.body.title ? ` title="${req.body.title}"` : ''}${req.body.link_url ? ` link="${req.body.link_url}"` : ''}`,
  ),
  updateBanner,
)

// PATCH /api/banners/:id/toggle — toggle isShow (Admin/Supervisor) + audit
router.patch(
  '/:id/toggle',
  auth,
  requireAdmin,
  audit('TOGGLE_BANNER', (req) => `Toggle แสดง/ซ่อน Banner #${req.params.id}`),
  toggleBannerVisibility,
)

// DELETE /api/banners/:id — ต้องล็อกอิน (Admin/Supervisor) + audit
router.delete(
  '/:id',
  auth,
  requireAdmin,
  audit('DELETE_BANNER', (req) => `ลบ Banner #${req.params.id}`),
  deleteBanner,
)

export default router
