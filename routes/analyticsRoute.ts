// routes/analyticsRoute.ts
import express, { Router } from 'express'
import { getVisitors } from '../controllers/analyticsController'

const router: Router = express.Router()

// GET /api/analytics/visitors — สาธารณะ (ตัวเลขผู้เข้าชมบน Footer)
// มี cache 10 นาทีใน service แล้ว จึงไม่กระทบ GA quota แม้ถูกเรียกบ่อย
router.get('/visitors', getVisitors)

export default router
