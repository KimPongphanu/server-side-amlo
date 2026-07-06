// server.ts
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import cron from 'node-cron' // 🌟 นำเข้า node-cron เข้ามาจัดการรอบเวลาทำงานเบื้องหลัง
import path from 'path'
import { globalErrorHandler } from './middlewares/errorHandler'
import { setCharset } from './middlewares/setCharset'
import prisma from './lib/prisma' // 🌟 นำเข้า prisma client เพื่อสั่งคำสั่งลบข้อมูลโดยตรง
import { apiLimiter } from './middlewares/rateLimiter'
import adminRoutes from './routes/adminRoute'
import auditRoutes from './routes/auditRoute'
import authRoutes from './routes/authRoute'
import backupRoutes from './routes/backupRoute'
import bannerRoutes from './routes/bannerRoute'
import commentRoutes from './routes/commentRoute'
import contactRoutes from './routes/contactRoute'
import departmentRoutes from './routes/departmentRoute'
import fileRoutes from './routes/fileRoute'
import footerSettingRoutes from './routes/footerSettingRoute'
import newsRoutes from './routes/newsRoute'
import sliderRoutes from './routes/sliderRoute'
import splashPopupRoutes from './routes/splashPopupRoute'
import supervisorRequestRoutes from './routes/supervisorRequestRoute'
import twoFactorRoutes from './routes/twoFactorRoute'
import uploadRoutes from './routes/uploadRoute'

const app: Express = express()
const port: number = 8080

// ── 1. ประกาศตั้งค่าพื้นฐานของระบบและ CORS ก่อนเริ่มแมป Route ──
app.set('trust proxy', 1) // trust first proxy (Nginx, Cloudflare, etc.)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(setCharset)

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://10.89.163.40:5173',
  'http://localhost',
  'http://127.0.0.1',
] // ตัวอย่าง

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://10.89.163.40:5173',
        'http://localhost',
        'http://127.0.0.1',
      ]
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
  }),
)

// ── 2. ประกาศใช้ Static Files และ Rate Limiter ส่วนกลาง ──
import fs from 'fs'
const UPLOADS_DIR = fs.existsSync('/app/uploads')
  ? '/app/uploads'
  : path.join(__dirname, 'uploads')
app.use('/uploads', express.static(UPLOADS_DIR))
app.use('/api', apiLimiter)

// ── 3. กลุ่ม Route บริการต่างๆ ──
app.use('/api/admin', adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/banners', bannerRoutes)
app.use('/api/settings', footerSettingRoutes)
app.use('/api/slider', sliderRoutes)
app.use('/api/splash-popups', splashPopupRoutes)
app.use('/api/2fa', twoFactorRoutes)
app.use('/api/supervisor-request', supervisorRequestRoutes)
app.use('/api/backups', backupRoutes)

app.get('/', (req: Request, res: Response) => {
  res.send('Server is running with TypeScript!')
})

app.use(globalErrorHandler)

// ── 4. Auto Backup — 03:00 daily ──
import { exec } from 'child_process'
cron.schedule('0 3 * * *', () => {
  const fs = require('fs') as typeof import('fs')
  const p = require('path') as typeof import('path')

  const pgDump = 'pg_dump'
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `backup_${date}.sql`
  const backupDir = '/app/backups'
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const outputFile = p.join(backupDir, filename)

  const url = new URL(process.env.DATABASE_URL!)
  const cmd = `${pgDump} --host=${url.hostname} --port=${url.port || '5432'} --username=${decodeURIComponent(url.username)} --dbname=${url.pathname.slice(1)} --file="${outputFile}" --format=plain --no-owner`

  exec(
    cmd,
    {
      env: { PGPASSWORD: decodeURIComponent(url.password) },
      timeout: 5 * 60 * 1000,
    },
    (err) => {
      if (err) return console.error('[Auto Backup] Failed:', err.message)
      console.log(
        `[Auto Backup] Created: ${filename} (${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)} MB)`,
      )
    },
  )
})

// ── 5. กลไกลบ Audit Log อัตโนมัติ (Data Retention Policy) ──
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

// ── 6. ลบ JWT Blacklist ที่หมดอายุแล้ว (ทุก 1 ชั่วโมง) ──
cron.schedule('0 * * * *', async () => {
  try {
    // Token อายุ 1 วัน ลบ token ที่เก่ากว่า 24 ชั่วโมง
    const cutOff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = await prisma.jwtBlacklist.deleteMany({
      where: { createdAt: { lt: cutOff } },
    })
    if (result.count > 0) {
      console.log(
        `[Cron Job] Cleaned ${result.count} expired JWT blacklist entries.`,
      )
    }
  } catch (error) {
    console.error('[Cron Job Error] Failed to clean JWT blacklist:', error)
  }
})

const PORT: number = Number(process.env.PORT) || 8080

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend Server is running on port ${PORT}`)
})
