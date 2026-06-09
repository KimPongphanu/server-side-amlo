// server.ts
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import cron from 'node-cron' // 🌟 นำเข้า node-cron เข้ามาจัดการรอบเวลาทำงานเบื้องหลัง
import path from 'path'
import { globalErrorHandler } from './middlewares/errorHandler'

import prisma from './lib/prisma' // 🌟 นำเข้า prisma client เพื่อสั่งคำสั่งลบข้อมูลโดยตรง
import { apiLimiter } from './middlewares/rateLimiter'
import auditRoutes from './routes/auditRoute'
import authRoutes from './routes/authRoute'
import commentRoutes from './routes/commentRoute'
import contactRoutes from './routes/contactRoute'
import departmentRoutes from './routes/departmentRoute'
import fileRoutes from './routes/fileRoute'
import newsRoutes from './routes/newsRoute'
import sliderRoutes from './routes/sliderRoute'
import uploadRoutes from './routes/uploadRoute'

const app: Express = express()
const port: number = 8080

// ── 1. ประกาศตั้งค่าพื้นฐานของระบบและ CORS ก่อนเริ่มแมป Route ──
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

const allowedOrigins = ['http://localhost:5173', 'http://172.20.10.3:5173'] // ตัวอย่าง

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  }),
)

// ── 2. ประกาศใช้ Static Files และ Rate Limiter ส่วนกลาง ──
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api', apiLimiter)

// ── 3. กลุ่ม Route บริการต่างๆ ──
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/slider', sliderRoutes)

app.get('/', (req: Request, res: Response) => {
  res.send('Server is running with TypeScript!')
})

app.use(globalErrorHandler)

// ── 4. กลไกลบ Audit Log อัตโนมัติ (Data Retention Policy) ──
// ตั้งค่ารันทำงานโดยอัตโนมัติในทุกๆ วันเวลาเที่ยงคืนตรง (00:00)
cron.schedule('0 0 * * *', async () => {
  try {
    const cutOffDate = new Date()
    cutOffDate.setDate(cutOffDate.getDate() - 90) // คำนวณช่วงเวลาถอยหลังย้อนหลัง 90 วัน

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutOffDate }, // สั่งลบแถวบันทึกที่มีอายุเก่ากว่าช่วงวันที่กำหนด
      },
    })
    console.log(
      `[Cron Job] Expired audit logs cleaned successfully. Deleted ${result.count} rows.`,
    )
  } catch (error) {
    console.error('[Cron Job Error] Failed to clean expired audit logs:', error)
  }
})

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
