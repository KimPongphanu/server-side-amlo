// server.ts
import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import path from 'path'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import { apiLimiter } from './middlewares/rateLimiter'
import authRoutes from './routes/authRoute'
import commentRoutes from './routes/commentRoute'
import contactRoutes from './routes/contactRoute'
import departmentRoutes from './routes/departmentRoute'
import fileRoutes from './routes/fileRoute'
import newsRoutes from './routes/newsRoute'
import uploadRoutes from './routes/uploadRoute'

const app: Express = express()
const port: number = 8080

// ── 1. ประกาศตั้งค่าพื้นฐานของระบบและ CORS ก่อนเริ่มแมป Route ──
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use(
  cors({
    origin: 'http://localhost:5173', // โดเมนของ Frontend
    credentials: true, // เปิดรองรับการส่ง Cookie ยืนยันตัวตน
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

app.get('/', (req: Request, res: Response) => {
  res.send('Server is running with TypeScript!')
})

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
