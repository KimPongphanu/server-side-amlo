import { Request } from 'express'
import prisma from '../lib/prisma'
import { getClientMetadata } from './ipSelector'

export const logAudit = async (
  req: Request,
  action: string,
  details: string,
  userId?: number | null,
) => {
  const { ipAddress, userAgent } = getClientMetadata(req)
  try {
    await prisma.auditLog.create({
      data: { userId, action, ipAddress, userAgent, details },
    })
  } catch (err) {
    console.error(`Audit Log Failed [${action}]:`, err)
  }
}
