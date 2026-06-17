// routes/backupRoute.ts
import { Router } from 'express'
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  listBackupFiles,
  restoreBackup,
} from '../controllers/backupController'
import auth, { requireSupervisor } from '../middlewares/auth'

const router = Router()

// All backup routes require auth + supervisor
router.use(auth, requireSupervisor)

router.get('/', listBackupFiles)
router.post('/', createBackup)
router.get('/:filename', downloadBackup)
router.delete('/:filename', deleteBackup)
router.post('/:filename/restore', restoreBackup)

export default router
