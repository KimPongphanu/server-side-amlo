// tests/gaService.test.ts
// ตรวจ GA4 Data API client ด้วย RSA keypair ที่สร้างเอง — ไม่ต้องมี Google account
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { describe, it } from 'node:test'
import {
  clearVisitorCache,
  createSignedJwt,
  fetchVisitorStats,
  getCachedVisitorStats,
  readGaConfig,
  type FetchLike,
  type GaConfig,
} from '../services/gaService'

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const config: GaConfig = {
  propertyId: '123456789',
  clientEmail: 'svc@amlo-test.iam.gserviceaccount.com',
  privateKey,
  rangeDays: 30,
}

const NOW = 1_760_000_000_000

const b64urlDecode = (value: string) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

const verifySignature = (jwt: string): boolean => {
  const [h, p, s] = jwt.split('.')
  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`),
    publicKey,
    b64urlDecode(s),
  )
}

const fakeFetch = (
  tokenOk: boolean,
  report: unknown,
  calls: { url: string; body?: string; headers?: Record<string, string> }[],
): FetchLike =>
  (async (url, init) => {
    calls.push({ url, body: init?.body, headers: init?.headers })
    if (url.includes('oauth2.googleapis.com')) {
      return {
        ok: tokenOk,
        status: tokenOk ? 200 : 401,
        json: async () => ({ access_token: 'ya29.FAKE' }),
        text: async () => (tokenOk ? '' : 'invalid_grant'),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => report,
      text: async () => '',
    }
  }) as FetchLike

describe('createSignedJwt', () => {
  it('ลงลายมือชื่อ RS256 ที่ verify ผ่านด้วย public key', () => {
    const jwt = createSignedJwt(config, NOW)
    assert.equal(verifySignature(jwt), true)
  })

  it('header ระบุ alg=RS256', () => {
    const [h] = createSignedJwt(config, NOW).split('.')
    assert.equal(JSON.parse(b64urlDecode(h).toString()).alg, 'RS256')
  })

  it('payload มี iss / scope / aud / exp ถูกต้อง', () => {
    const [, p] = createSignedJwt(config, NOW).split('.')
    const payload = JSON.parse(b64urlDecode(p).toString()) as {
      iss: string
      scope: string
      aud: string
      iat: number
      exp: number
    }
    const iat = Math.floor(NOW / 1000)
    assert.equal(payload.iss, config.clientEmail)
    assert.equal(
      payload.scope,
      'https://www.googleapis.com/auth/analytics.readonly',
    )
    assert.equal(payload.aud, 'https://oauth2.googleapis.com/token')
    assert.equal(payload.iat, iat)
    assert.equal(payload.exp, iat + 3600)
  })

  it('ลายมือชื่อเปลี่ยนเมื่อ private key ต่างกัน', () => {
    const other = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const jwtA = createSignedJwt(config, NOW)
    const jwtB = createSignedJwt(
      { ...config, privateKey: other.privateKey },
      NOW,
    )
    assert.notEqual(jwtA.split('.')[2], jwtB.split('.')[2])
  })
})

describe('fetchVisitorStats', () => {
  it('ดึง totalUsers / pageViews และยิง endpoint ถูกต้อง', async () => {
    const calls: { url: string; body?: string; headers?: Record<string, string> }[] =
      []
    const stats = await fetchVisitorStats(config, {
      fetchImpl: fakeFetch(
        true,
        { rows: [{ metricValues: [{ value: '4321' }, { value: '9876' }] }] },
        calls,
      ),
      nowMs: NOW,
    })

    assert.equal(stats.totalUsers, 4321)
    assert.equal(stats.pageViews, 9876)
    assert.equal(stats.configured, true)
    assert.equal(stats.rangeDays, 30)

    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token')
    assert.match(calls[0].body || '', /grant_type=urn%3Aietf%3Aparams%3Aoauth/)
    assert.match(calls[0].body || '', /assertion=/)

    assert.equal(
      calls[1].url,
      'https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport',
    )
    assert.equal(calls[1].headers?.Authorization, 'Bearer ya29.FAKE')

    const reportBody = JSON.parse(calls[1].body || '{}') as {
      dateRanges: { startDate: string; endDate: string }[]
      metrics: { name: string }[]
    }
    assert.equal(reportBody.dateRanges[0].startDate, '30daysAgo')
    assert.equal(reportBody.dateRanges[0].endDate, 'yesterday')
    assert.deepEqual(
      reportBody.metrics.map((m) => m.name),
      ['totalUsers', 'screenPageViews'],
    )
  })

  it('รายงานว่าง → คืน 0 ไม่ throw', async () => {
    const stats = await fetchVisitorStats(config, {
      fetchImpl: fakeFetch(true, {}, []),
      nowMs: NOW,
    })
    assert.equal(stats.totalUsers, 0)
    assert.equal(stats.pageViews, 0)
  })

  it('token request ล้มเหลว → throw พร้อมข้อความอ่านออก', async () => {
    await assert.rejects(
      () =>
        fetchVisitorStats(config, {
          fetchImpl: fakeFetch(false, {}, []),
          nowMs: NOW,
        }),
      /GA token request failed/,
    )
  })
})

describe('cache', () => {
  it('ภายใน TTL เรียกซ้ำไม่ยิง fetch ใหม่ และหมดอายุแล้วยิงใหม่', async () => {
    clearVisitorCache()
    let hits = 0
    const counting = (async (url: string) => {
      hits++
      if (url.includes('oauth2')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 't' }),
          text: async () => '',
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ rows: [{ metricValues: [{ value: '1' }, { value: '2' }] }] }),
        text: async () => '',
      }
    }) as FetchLike

    await getCachedVisitorStats(config, { fetchImpl: counting, nowMs: NOW })
    const afterFirst = hits
    await getCachedVisitorStats(config, {
      fetchImpl: counting,
      nowMs: NOW + 1000,
    })
    assert.equal(hits, afterFirst, 'cache ต้องไม่ยิง fetch ซ้ำภายใน TTL')

    await getCachedVisitorStats(config, {
      fetchImpl: counting,
      nowMs: NOW + 11 * 60 * 1000,
    })
    assert.ok(hits > afterFirst, 'cache หมดอายุต้องยิงใหม่')
    clearVisitorCache()
  })
})

describe('readGaConfig', () => {
  it('ไม่มี env → null', () => {
    assert.equal(readGaConfig({} as NodeJS.ProcessEnv), null)
  })

  it('ค่าไม่ครบ → null', () => {
    assert.equal(
      readGaConfig({
        GA_PROPERTY_ID: '1',
        GA_CLIENT_EMAIL: 'a@b.com',
      } as NodeJS.ProcessEnv),
      null,
    )
  })

  it('private key ผิดรูปแบบ → null (ไม่ทำให้ server crash)', () => {
    assert.equal(
      readGaConfig({
        GA_PROPERTY_ID: '1',
        GA_CLIENT_EMAIL: 'a@b.com',
        GA_PRIVATE_KEY: 'not-a-key',
      } as NodeJS.ProcessEnv),
      null,
    )
  })

  it('แปลง \\n เป็น newline, trim ค่า, และอ่าน rangeDays', () => {
    const cfg = readGaConfig({
      GA_PROPERTY_ID: ' 123 ',
      GA_CLIENT_EMAIL: ' a@b.com ',
      GA_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
      GA_RANGE_DAYS: '7',
    } as NodeJS.ProcessEnv)

    assert.ok(cfg)
    assert.equal(cfg.propertyId, '123')
    assert.equal(cfg.clientEmail, 'a@b.com')
    assert.equal(cfg.rangeDays, 7)
    assert.ok(cfg.privateKey.includes('\n'))
  })

  it('config ที่ได้จาก env ลงลายมือชื่อได้จริง', () => {
    const cfg = readGaConfig({
      GA_PROPERTY_ID: '123',
      GA_CLIENT_EMAIL: 'a@b.com',
      GA_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
    } as NodeJS.ProcessEnv)
    assert.ok(cfg)
    assert.equal(verifySignature(createSignedJwt(cfg, NOW)), true)
  })

  it('rangeDays ที่ไม่ถูกต้อง → ใช้ค่า default', () => {
    const cfg = readGaConfig({
      GA_PROPERTY_ID: '123',
      GA_CLIENT_EMAIL: 'a@b.com',
      GA_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
      GA_RANGE_DAYS: 'abc',
    } as NodeJS.ProcessEnv)
    assert.ok(cfg)
    assert.equal(cfg.rangeDays, 30)
  })
})
