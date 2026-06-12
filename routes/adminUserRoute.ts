// routes/adminUserRoute.ts
import { Router } from 'express'
import {
  banAdmin,
  createAdmin,
  deleteAdmin,
  getAdminById,
  getAdmins,
  unbanAdmin,
  updateAdmin,
} from '../controllers/adminUserController'
import authMiddleware, { requireSupervisor } from '../middlewares/auth'

const router = Router()

// Use authMiddleware as a function
router.use(authMiddleware)
router.use(requireSupervisor)

router.post('/', createAdmin)
router.get('/', getAdmins)
router.get('/:uuid', getAdminById)
router.put('/:uuid', updateAdmin)
router.put('/:uuid/ban', banAdmin)
router.put('/:uuid/unban', unbanAdmin)
router.delete('/:uuid', deleteAdmin)

export default router
