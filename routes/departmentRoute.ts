import { Router } from 'express'
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from '../controllers/departmentController'
import auth, { requireAdmin } from '../middlewares/auth'
import { uploadLimiter } from '../middlewares/rateLimiter'
import upload from '../middlewares/upload'

const router = Router()

router.post(
  '/',
  auth,
  requireAdmin,
  uploadLimiter,
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  createDepartment,
)

router.get('/', getDepartments)

router.delete('/:id', auth, requireAdmin, deleteDepartment)

router.put(
  '/:id',
  auth,
  requireAdmin,
  uploadLimiter,
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  updateDepartment,
)

export default router
