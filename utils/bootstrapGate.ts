// utils/bootstrapGate.ts
// 🌟 ลำดับ bootstrap ของบัญชี admin: 2FA enrollment -> เปลี่ยนรหัสผ่านชั่วคราว
// แยกเป็น pure function เพื่อทดสอบได้โดยไม่ต้องมี DB/HTTP

export type BootstrapStage = 'ENROLL_2FA' | 'CHANGE_PASSWORD' | 'ACTIVE'

export type BootstrapDecision =
  | { allowed: true }
  | { allowed: false; stage: BootstrapStage; reason: string }

const BASE_ALLOWED = ['/api/auth/me', '/api/auth/logout', '/api/auth/heartbeat']

/** เส้นทางที่อนุญาตระหว่างขั้น enroll 2FA */
export const ENROLLMENT_ALLOWED_PATHS = new Set<string>([
  ...BASE_ALLOWED,
  '/api/2fa/setup',
  '/api/2fa/enable',
])

/** เส้นทางที่อนุญาตหลัง enroll 2FA แล้ว แต่ยังใช้รหัสผ่านชั่วคราวอยู่ */
export const PASSWORD_CHANGE_ALLOWED_PATHS = new Set<string>([
  ...BASE_ALLOWED,
  '/api/auth/force-reset/verify',
])

/**
 * ตัดสินว่าคำขอนี้ผ่าน bootstrap gate หรือไม่
 *
 * @param fullPath path เต็ม เช่น '/api/2fa/setup' (baseUrl + path ของ router)
 */
export const decideBootstrapAccess = (params: {
  forcePasswordReset: boolean | undefined
  twoFactorEnabled: boolean | undefined
  fullPath: string
}): BootstrapDecision => {
  const { forcePasswordReset, twoFactorEnabled, fullPath } = params

  if (!forcePasswordReset) {
    return { allowed: true }
  }

  if (!twoFactorEnabled) {
    if (ENROLLMENT_ALLOWED_PATHS.has(fullPath)) {
      return { allowed: true }
    }
    return {
      allowed: false,
      stage: 'ENROLL_2FA',
      reason: 'ต้องเปิดใช้งาน 2FA ก่อนจึงจะใช้งานระบบได้',
    }
  }

  if (PASSWORD_CHANGE_ALLOWED_PATHS.has(fullPath)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    stage: 'CHANGE_PASSWORD',
    reason: 'ต้องเปลี่ยนรหัสผ่านก่อนจึงจะใช้งานระบบได้',
  }
}
