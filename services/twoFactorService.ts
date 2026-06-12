// services/twoFactorService.ts
import speakeasy from 'speakeasy'

// ลบ authenticator.options แล้วใช้ speakeasy.totp แทน
export const generateTOTPSecret = (email: string) => {
  const secret = speakeasy.generateSecret({
    name: `AMLO System (${email})`,
    length: 20,
  })
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  }
}

export const verifyTOTP = (token: string, secret: string): boolean => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1,
  })
}
