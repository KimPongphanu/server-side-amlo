// utils/auditLogger.ts
import { Request } from 'express'
import prisma from '../lib/prisma'
import { getClientMetadata } from './ipSelector'

const GEO_CACHE = new Map<string, { region: string; cachedAt: number }>()
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000 // Cache GeoIP 24 ชม.
// 🌟 ใช้ provider ที่รองรับ HTTPS (ip-api.com ฟรีรองรับเฉพาะ HTTP — ไม่ปลอดภัยพอ)
const GEO_API_URL = 'https://freeipapi.com/api/json'

const lookupGeoRegion = async (ip: string): Promise<string | null> => {
  // ถ้าเป็น private/local IP ไม่ต้อง query Geo
  if (
    !ip ||
    ip === '0.0.0.0' ||
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return null
  }

  // Check cache
  const cached = GEO_CACHE.get(ip)
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
    return cached.region
  }

  try {
    const res = await fetch(`${GEO_API_URL}/${ip}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      countryName?: string
      regionName?: string
      cityName?: string
    }
    if (data.countryName) {
      const region = `${data.countryName}, ${data.regionName || '-'}, ${data.cityName || '-'}`
      GEO_CACHE.set(ip, { region, cachedAt: Date.now() })
      return region
    }
  } catch {
    // fail silently — ไม่ blocking
  }
  return null
}

const enrichRegion = async (logId: string, ipAddress: string) => {
  const region = await lookupGeoRegion(ipAddress)
  if (!region) return
  await prisma.auditLog.update({
    where: { id: logId },
    data: { region },
  })
}

export const logAudit = async (
  req: Request,
  action: string,
  details: string,
  userId?: number | null,
) => {
  const { ipAddress, serverIp, userAgent } = getClientMetadata(req)
  try {
    const log = await prisma.auditLog.create({
      data: {
        userId,
        action,
        ipAddress,
        serverIp,
        region: null,
        userAgent,
        details,
      },
      select: { id: true },
    })
    // 🌟 GeoIP เป็นข้อมูลเสริม — เติม region หลังบันทึก audit แล้ว ไม่ block response
    void enrichRegion(log.id, ipAddress).catch((err) =>
      console.error('Audit Log region update failed:', err),
    )
  } catch (err) {
    console.error(`Audit Log Failed [${action}]:`, err)
  }
}
