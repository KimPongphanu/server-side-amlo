// utils/auditLogger.ts
import { Request } from 'express'
import prisma from '../lib/prisma'
import { getClientMetadata } from './ipSelector'

const GEO_CACHE = new Map<string, { region: string; cachedAt: number }>()
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000 // Cache GeoIP 24 ชม.
const GEO_API_URL = 'http://ip-api.com/json'

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
    const res = await fetch(
      `${GEO_API_URL}/${ip}?fields=country,regionName,city`,
      { signal: AbortSignal.timeout(3000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      country: string
      regionName: string
      city: string
    }
    if (data.country) {
      const region = `${data.country}, ${data.regionName}, ${data.city}`
      GEO_CACHE.set(ip, { region, cachedAt: Date.now() })
      return region
    }
  } catch {
    // fail silently — ไม่ blocking
  }
  return null
}

export const logAudit = async (
  req: Request,
  action: string,
  details: string,
  userId?: number | null,
) => {
  const { ipAddress, serverIp, userAgent } = getClientMetadata(req)
  const region = await lookupGeoRegion(ipAddress)
  try {
    await prisma.auditLog.create({
      data: { userId, action, ipAddress, serverIp, region, userAgent, details },
    })
  } catch (err) {
    console.error(`Audit Log Failed [${action}]:`, err)
  }
}
