// tests/utils.test.ts
// Unit tests สำหรับ pure logic ของ backend — รันด้วย Node test runner (ไม่มี dependency เพิ่ม)
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { escapeHtml } from '../utils/escapeHtml'
import {
  TEMP_PASSWORD_TTL_HOURS,
  isTempPasswordExpired,
  tempPasswordExpiredMessage,
} from '../utils/tempPasswordPolicy'
import { getClientMetadata } from '../utils/ipSelector'

describe('escapeHtml', () => {
  it('escape อักขระ HTML ทั้งหมด', () => {
    assert.equal(
      escapeHtml(`<script>alert("x")</script>`),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;&#x2F;script&gt;',
    )
  })

  it('escape & และ single quote', () => {
    assert.equal(escapeHtml(`a&b'c`), 'a&amp;b&#39;c')
  })

  it('คืน string ว่างเมื่อได้ null / undefined', () => {
    assert.equal(escapeHtml(null), '')
    assert.equal(escapeHtml(undefined), '')
  })

  it('แปลงค่าที่ไม่ใช่ string ได้', () => {
    assert.equal(escapeHtml(42), '42')
    assert.equal(escapeHtml(true), 'true')
  })

  it('ข้อความปกติไม่ถูกแก้', () => {
    assert.equal(escapeHtml('สวัสดี hello'), 'สวัสดี hello')
  })
})

describe('isTempPasswordExpired', () => {
  const now = new Date('2026-01-10T12:00:00Z')

  it('ไม่มี issuedAt → ไม่ถือว่าหมดอายุ', () => {
    assert.equal(isTempPasswordExpired(null, now), false)
    assert.equal(isTempPasswordExpired(undefined, now), false)
  })

  it('ออกใหม่ ๆ → ยังไม่หมดอายุ', () => {
    const issued = new Date(now.getTime() - 60 * 60 * 1000) // 1 ชม.
    assert.equal(isTempPasswordExpired(issued, now), false)
  })

  it('ยังไม่ถึงขอบเขต TTL → ไม่หมดอายุ', () => {
    const issued = new Date(
      now.getTime() - (TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000 - 1000),
    )
    assert.equal(isTempPasswordExpired(issued, now), false)
  })

  it('เกิน TTL → หมดอายุ', () => {
    const issued = new Date(
      now.getTime() - (TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000 + 1000),
    )
    assert.equal(isTempPasswordExpired(issued, now), true)
  })

  it('ข้อความแจ้งเตือนระบุ TTL ถูกต้อง', () => {
    assert.match(tempPasswordExpiredMessage(), /72 ชั่วโมง/)
  })
})

describe('getClientMetadata', () => {
  it('อ่าน ip / socket address / user-agent จาก request', () => {
    const req = {
      ip: '203.0.113.9',
      socket: { remoteAddress: '172.19.0.1' },
      headers: { 'user-agent': 'Mozilla/5.0 Test' },
    } as unknown as Parameters<typeof getClientMetadata>[0]

    const meta = getClientMetadata(req)
    assert.equal(meta.ipAddress, '203.0.113.9')
    assert.equal(meta.serverIp, '172.19.0.1')
    assert.equal(meta.userAgent, 'Mozilla/5.0 Test')
  })

  it('มี fallback เมื่อไม่มีข้อมูล', () => {
    const req = { headers: {} } as unknown as Parameters<
      typeof getClientMetadata
    >[0]

    const meta = getClientMetadata(req)
    assert.equal(meta.ipAddress, '0.0.0.0')
    assert.equal(meta.userAgent, 'Unknown Device')
  })
})
