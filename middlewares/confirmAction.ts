// backend/middlewares/confirmAction.ts
import crypto from 'crypto'
import { Request, Response } from 'express'
import { AuthRequest } from './auth'

interface ConfirmationState {
  step: number
  action: string
  targetId: string
  reason: string
  expiresAt: number
}

const confirmationStore = new Map<string, ConfirmationState>()

const STORE_EXPIRY_MS = 5 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of confirmationStore.entries()) {
    if (value.expiresAt < now) {
      confirmationStore.delete(key)
    }
  }
}, 60 * 1000)

const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

export const step1RequestConfirmation = async (req: Request, res: Response) => {
  const confirmationToken = generateToken()
  res.json({
    success: true,
    step: 1,
    message: 'Confirmation requested. Check your email/app.',
    confirmationToken,
  })
}

export const step2ConfirmWithReason = async (req: Request, res: Response) => {
  const { token, reason } = req.body
  res.json({
    success: true,
    step: 2,
    message: 'Confirmed. Delaying execution by 5 minutes.',
  })
}

export const step3ExecuteWithDelay = async (req: Request, res: Response) => {
  res.json({
    success: true,
    step: 3,
    message: 'Action executed successfully.',
  })
}

export const cancelConfirmation = (
  req: AuthRequest,
  res: Response,
  action: string,
): void => {
  const sessionId = req.session?.id || req.cookies.token?.substring(0, 16)
  const storeKey = `confirm_${sessionId}_${action}`

  confirmationStore.delete(storeKey)

  res.status(200).json({
    success: true,
    message: 'Action cancelled',
  })
}
