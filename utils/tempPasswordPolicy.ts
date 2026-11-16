// utils/tempPasswordPolicy.ts
// นโยบายอายุของ "รหัสผ่านชั่วคราว" ที่ Supervisor ตั้งให้ (หรือที่ระบบสร้างให้)
// ใช้คู่กับ User.tempPasswordIssuedAt — หมดอายุแล้วต้องให้ Supervisor ออกให้ใหม่เท่านั้น

export const TEMP_PASSWORD_TTL_HOURS = 72

export const isTempPasswordExpired = (
  issuedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!issuedAt) return false
  const ageMs = now.getTime() - new Date(issuedAt).getTime()
  return ageMs > TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000
}

export const tempPasswordExpiredMessage = (): string =>
  `รหัสผ่านชั่วคราวหมดอายุแล้ว (เกิน ${TEMP_PASSWORD_TTL_HOURS} ชั่วโมง) กรุณาติดต่อ Supervisor เพื่อออกให้ใหม่`
