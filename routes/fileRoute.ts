// routes/fileRoute.ts
import express, { Response, Router } from 'express'
import path from 'path'
import auth, { AuthRequest } from '../middlewares/auth'

const router: Router = express.Router()

router.get('/private/:filename', auth, (req: AuthRequest, res: Response) => {
  // ✅ ใช้ as string บังคับประเภทข้อมูลเพื่อแก้ Error
  const fileName = req.params.filename as string
  const filePath = path.join(__dirname, '../private_uploads', fileName)

  res.sendFile(filePath)
})

export default router
