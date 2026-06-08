import { Request } from 'express'

export const getClientMetadata = (req: Request) => {
  // ดักจับ IP จริงจาก Header หากระบบรันหลัง Nginx, Cloudflare, Vercel หรือ Render
  const forwardedFor = req.headers['x-forwarded-for']
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0] || req.ip || '0.0.0.0'

  // ดึงประเภทอุปกรณ์/เบราว์เซอร์
  const userAgent = req.headers['user-agent'] || 'Unknown Device'

  return { ipAddress, userAgent }
}
