// middlewares/confirmAction.ts
import { Response } from 'express'
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

export const step1RequestConfirmation = (
  req: AuthRequest,
  res: Response,
  action: string,
  targetId: string,
  targetName: string,
  targetEmail: string,
): void => {
  const sessionId = req.session?.id || req.cookies.token?.substring(0, 16)
  const storeKey = `confirm_${sessionId}_${action}`

  confirmationStore.set(storeKey, {
    step: 1,
    action,
    targetId,
    reason: '',
    expiresAt: Date.now() + STORE_EXPIRY_MS,
  })

  res.status(200).json({
    success: true,
    step: 1,
    message: 'Please confirm this action',
    data: {
      action,
      target: {
        id: targetId,
        name: targetName,
        email: targetEmail,
      },
    },
  })
}

export const step2ConfirmWithReason = (
  req: AuthRequest,
  res: Response,
  action: string,
  reason: string,
): boolean => {
  const sessionId = req.session?.id || req.cookies.token?.substring(0, 16)
  const storeKey = `confirm_${sessionId}_${action}`

  const state = confirmationStore.get(storeKey)
  if (!state || state.step !== 1) {
    res.status(400).json({
      success: false,
      message: 'Confirmation session expired or invalid. Please start over.',
    })
    return false
  }

  if (!reason || reason.trim().length < 5) {
    res.status(400).json({
      success: false,
      message: 'Reason must be at least 5 characters',
    })
    return false
  }

  state.step = 2
  state.reason = reason.trim()
  confirmationStore.set(storeKey, state)

  res.status(200).json({
    success: true,
    step: 2,
    message:
      'Please confirm again. This action will be executed after 5 seconds.',
    data: {
      action,
      reason: reason.trim(),
    },
  })

  return true
}

export const step3ExecuteWithDelay = async (
  req: AuthRequest,
  res: Response,
  action: string,
  executor: (
    reason: string,
  ) => Promise<{ success: boolean; message?: string; data?: unknown }>,
): Promise<void> => {
  const sessionId = req.session?.id || req.cookies.token?.substring(0, 16)
  const storeKey = `confirm_${sessionId}_${action}`

  const state = confirmationStore.get(storeKey)
  if (!state || state.step !== 2) {
    res.status(400).json({
      success: false,
      message: 'Confirmation session expired. Please start over.',
    })
    return
  }

  const delayMs = 5000
  const startTime = Date.now()

  res.status(200).json({
    success: true,
    step: 3,
    message: `Action will execute in 5 seconds. You can cancel now.`,
    data: {
      action,
      reason: state.reason,
      cancelWindowMs: delayMs,
    },
  })

  const timer = setTimeout(async () => {
    try {
      const result = await executor(state.reason)

      confirmationStore.delete(storeKey)

      if (result.success) {
        res.status(200).json({
          success: true,
          step: 4,
          message: result.message || 'Action completed successfully',
          data: result.data,
        })
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Action failed',
        })
      }
    } catch (error) {
      console.error('Action execution error:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error during action execution',
      })
    }
  }, delayMs)

  const cancelHandler = () => {
    clearTimeout(timer)
    confirmationStore.delete(storeKey)
    res.status(200).json({
      success: false,
      step: 3,
      message: 'Action cancelled by user',
    })
  }

  req.on('close', () => {
    if (!res.headersSent) {
      cancelHandler()
    }
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
