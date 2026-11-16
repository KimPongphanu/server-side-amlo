// services/gaService.ts
// ดึงสถิติผู้เข้าชมจาก Google Analytics 4 (Data API) ด้วย Service Account
// ใช้ node:crypto + fetch ของ Node เอง — ไม่ต้องเพิ่ม dependency ใหม่
import crypto from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

export const DEFAULT_RANGE_DAYS = 30
export const CACHE_TTL_MS = 10 * 60 * 1000

export interface GaConfig {
  propertyId: string
  clientEmail: string
  privateKey: string
  rangeDays: number
}

export interface VisitorStats {
  configured: true
  totalUsers: number
  pageViews: number
  rangeDays: number
  fetchedAt: string
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text?: () => Promise<string>
}>

const base64Url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const readPositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt((raw || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * อ่านค่า config จาก env — คืน null เมื่อยังไม่ได้ตั้งค่า (ไม่ throw)
 * รองรับ GA_PRIVATE_KEY ที่เก็บ newline เป็น \n (รูปแบบใน .env)
 */
export const readGaConfig = (
  env: NodeJS.ProcessEnv = process.env,
): GaConfig | null => {
  const propertyId = (env.GA_PROPERTY_ID || '').trim()
  const clientEmail = (env.GA_CLIENT_EMAIL || '').trim()
  const privateKeyRaw = (env.GA_PRIVATE_KEY || '').trim()

  if (!propertyId || !clientEmail || !privateKeyRaw) return null

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  if (!privateKey.includes('BEGIN PRIVATE KEY')) return null

  return {
    propertyId,
    clientEmail,
    privateKey,
    rangeDays: readPositiveInt(env.GA_RANGE_DAYS, DEFAULT_RANGE_DAYS),
  }
}

/**
 * สร้าง JWT ที่ลงลายมือชื่อด้วย RS256 สำหรับ OAuth2 Service Account flow
 * แยกเป็นฟังก์ชันบริสุทธิ์เพื่อให้ unit test ตรวจลายเซ็นได้จริง
 */
export const createSignedJwt = (config: GaConfig, nowMs: number): string => {
  const iat = Math.floor(nowMs / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  )

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(config.privateKey)

  return `${header}.${payload}.${base64Url(signature)}`
}

export const getAccessToken = async (
  config: GaConfig,
  fetchImpl: FetchLike,
  nowMs: number,
): Promise<string> => {
  const assertion = createSignedJwt(config, nowMs)

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: JWT_GRANT_TYPE,
      assertion,
    }).toString(),
  })

  if (!response.ok) {
    const detail = response.text ? await response.text() : ''
    throw new Error(
      `GA token request failed (${response.status}): ${detail.slice(0, 300)}`,
    )
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('GA token response missing access_token')
  }
  return data.access_token
}

interface RunReportResponse {
  rows?: { metricValues?: { value?: string }[] }[]
}

/**
 * เรียก Data API เพื่อดึง totalUsers / screenPageViews ตามช่วงวันที่กำหนด
 */
export const fetchVisitorStats = async (
  config: GaConfig,
  options: { fetchImpl?: FetchLike; nowMs?: number } = {},
): Promise<VisitorStats> => {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike)
  const nowMs = options.nowMs ?? Date.now()

  const accessToken = await getAccessToken(config, fetchImpl, nowMs)

  const url = `${DATA_API_BASE}/properties/${encodeURIComponent(
    config.propertyId,
  )}:runReport`

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [
        { startDate: `${config.rangeDays}daysAgo`, endDate: 'yesterday' },
      ],
      metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
    }),
  })

  if (!response.ok) {
    const detail = response.text ? await response.text() : ''
    throw new Error(
      `GA report request failed (${response.status}): ${detail.slice(0, 300)}`,
    )
  }

  const report = (await response.json()) as RunReportResponse
  const values = report.rows?.[0]?.metricValues ?? []

  return {
    configured: true,
    totalUsers: Number.parseInt(values[0]?.value ?? '0', 10) || 0,
    pageViews: Number.parseInt(values[1]?.value ?? '0', 10) || 0,
    rangeDays: config.rangeDays,
    fetchedAt: new Date(nowMs).toISOString(),
  }
}

let cache: { expiresAt: number; value: VisitorStats } | null = null

export const getCachedVisitorStats = async (
  config: GaConfig,
  options: { fetchImpl?: FetchLike; nowMs?: number; bypassCache?: boolean } = {},
): Promise<VisitorStats> => {
  const nowMs = options.nowMs ?? Date.now()

  if (!options.bypassCache && cache && cache.expiresAt > nowMs) {
    return cache.value
  }

  const value = await fetchVisitorStats(config, options)
  cache = { expiresAt: nowMs + CACHE_TTL_MS, value }
  return value
}

/** ใช้ในเทสต์เท่านั้น — ล้าง cache ระหว่างเคส */
export const clearVisitorCache = (): void => {
  cache = null
}
