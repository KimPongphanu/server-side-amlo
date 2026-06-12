// controllers/adminUserController.ts
import bcrypt from 'bcryptjs'
import { Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { revokeAllUserSessions } from '../middlewares/session'
import { sendUserActionAlert } from '../services/emailService'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

interface CreateAdminBody {
  email: string
  password: string
  firstname: string
  lastname: string
}

interface UpdateAdminBody {
  firstname?: string
  lastname?: string
}

interface BanAdminBody {
  reason: string
}

const validatePasswordStrength = (
  password: string,
  isSupervisor: boolean,
): string | null => {
  if (isSupervisor) {
    if (password.length < 16) {
      return 'Supervisor password must be at least 16 characters'
    }
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/
    if (!strongRegex.test(password)) {
      return 'Supervisor password must contain uppercase, lowercase, number, and special character'
    }
  } else {
    if (password.length < 8) {
      return 'Password must be at least 8 characters'
    }
    const mediumRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/
    if (!mediumRegex.test(password)) {
      return 'Password must contain uppercase, lowercase, and number'
    }
  }
  return null
}

const checkPasswordHistory = async (
  userId: number,
  newPasswordHash: string,
): Promise<boolean> => {
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  for (const record of history) {
    const isMatch = await bcrypt.compare(newPasswordHash, record.passwordHash)
    if (isMatch) return false
  }
  return true
}

const addToPasswordHistory = async (
  userId: number,
  passwordHash: string,
): Promise<void> => {
  await prisma.passwordHistory.create({
    data: {
      userId,
      passwordHash,
    },
  })
}

export const createAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { email, password, firstname, lastname } = req.body as CreateAdminBody
    const { ipAddress, userAgent } = getClientMetadata(req)

    if (!email || !password || !firstname || !lastname) {
      res.status(400).json({ message: 'All fields are required' })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: 'Invalid email format' })
      return
    }

    const domainMatch = email.match(/@(.+)$/)
    if (!domainMatch || !domainMatch[1].includes('go.th')) {
      res
        .status(400)
        .json({ message: 'Only organization email (.go.th) is allowed' })
      return
    }

    const passwordError = validatePasswordStrength(password, false)
    if (passwordError) {
      res.status(400).json({ message: passwordError })
      return
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      res.status(400).json({ message: 'Email already exists' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const newAdmin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        role: 'ADMIN',
        twoFactorMethod: 'NONE',
        twoFactorEnabled: false,
      },
    })

    await addToPasswordHistory(newAdmin.id, hashedPassword)

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'CREATE_ADMIN_SUCCESS',
      `Supervisor created new admin: ${email.toLowerCase()} (Admin ID: ${newAdmin.id})`,
      supervisor?.id,
    )

    const supervisorUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (supervisorUser) {
      await sendUserActionAlert(
        supervisorUser.email,
        `${supervisorUser.firstname} ${supervisorUser.lastname}`,
        newAdmin.email,
        `${newAdmin.firstname} ${newAdmin.lastname}`,
        'CREATE_ADMIN',
        `New admin account created by supervisor`,
        `${req.user?.firstName} ${req.user?.lastName}`,
        ipAddress,
      )
    }

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        id: newAdmin.uuid,
        email: newAdmin.email,
        firstname: newAdmin.firstname,
        lastname: newAdmin.lastname,
        role: newAdmin.role,
        createdAt: newAdmin.createdAt,
      },
    })
  },
)

export const getAdmins = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstname: true,
        lastname: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        recentOnline: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins,
    })
  },
)

export const getAdminById = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params

    const admin = await prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstname: true,
        lastname: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        recentOnline: true,
      },
    })

    if (!admin || admin.role !== 'ADMIN') {
      res.status(404).json({ message: 'Admin not found' })
      return
    }

    res.status(200).json({
      success: true,
      data: admin,
    })
  },
)

export const updateAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params
    const { firstname, lastname } = req.body as UpdateAdminBody
    const { ipAddress, userAgent } = getClientMetadata(req)

    const admin = await prisma.user.findUnique({
      where: { uuid },
    })

    if (!admin || admin.role !== 'ADMIN') {
      res.status(404).json({ message: 'Admin not found' })
      return
    }

    const updateData: { firstname?: string; lastname?: string } = {}
    if (firstname) updateData.firstname = firstname.trim()
    if (lastname) updateData.lastname = lastname.trim()

    const updatedAdmin = await prisma.user.update({
      where: { uuid },
      data: updateData,
    })

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'UPDATE_ADMIN_SUCCESS',
      `Supervisor updated admin: ${admin.email} (Admin ID: ${admin.id})`,
      supervisor?.id,
    )

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      data: {
        uuid: updatedAdmin.uuid,
        email: updatedAdmin.email,
        firstname: updatedAdmin.firstname,
        lastname: updatedAdmin.lastname,
      },
    })
  },
)

export const banAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params
    const { reason } = req.body as BanAdminBody
    const { ipAddress, userAgent } = getClientMetadata(req)

    if (!reason || reason.trim().length === 0) {
      res
        .status(400)
        .json({ message: 'Reason is required for banning an admin' })
      return
    }

    const admin = await prisma.user.findUnique({
      where: { uuid },
    })

    if (!admin || admin.role !== 'ADMIN') {
      res.status(404).json({ message: 'Admin not found' })
      return
    }

    if (admin.role === 'SUPERVISOR') {
      res.status(403).json({ message: 'Cannot ban supervisor account' })
      return
    }

    const isCurrentlyBanned = admin.status === 'Inactive'

    const updatedAdmin = await prisma.user.update({
      where: { uuid },
      data: { status: 'Inactive' },
    })

    await revokeAllUserSessions(admin.id)

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'BAN_ADMIN_SUCCESS',
      `Supervisor banned admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`,
      supervisor?.id,
    )

    const supervisorUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (supervisorUser) {
      await sendUserActionAlert(
        supervisorUser.email,
        `${supervisorUser.firstname} ${supervisorUser.lastname}`,
        admin.email,
        `${admin.firstname} ${admin.lastname}`,
        'BAN_ADMIN',
        reason,
        `${req.user?.firstName} ${req.user?.lastName}`,
        ipAddress,
      )
    }

    res.status(200).json({
      success: true,
      message: 'Admin has been banned',
      data: {
        uuid: updatedAdmin.uuid,
        email: updatedAdmin.email,
        status: updatedAdmin.status,
      },
    })
  },
)

export const unbanAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params
    const { reason } = req.body as BanAdminBody
    const { ipAddress, userAgent } = getClientMetadata(req)

    if (!reason || reason.trim().length === 0) {
      res
        .status(400)
        .json({ message: 'Reason is required for unbanning an admin' })
      return
    }

    const admin = await prisma.user.findUnique({
      where: { uuid },
    })

    if (!admin || admin.role !== 'ADMIN') {
      res.status(404).json({ message: 'Admin not found' })
      return
    }

    const updatedAdmin = await prisma.user.update({
      where: { uuid },
      data: { status: 'Active' },
    })

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'UNBAN_ADMIN_SUCCESS',
      `Supervisor unbanned admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`,
      supervisor?.id,
    )

    const supervisorUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (supervisorUser) {
      await sendUserActionAlert(
        supervisorUser.email,
        `${supervisorUser.firstname} ${supervisorUser.lastname}`,
        admin.email,
        `${admin.firstname} ${admin.lastname}`,
        'UNBAN_ADMIN',
        reason,
        `${req.user?.firstName} ${req.user?.lastName}`,
        ipAddress,
      )
    }

    res.status(200).json({
      success: true,
      message: 'Admin has been unbanned',
      data: {
        uuid: updatedAdmin.uuid,
        email: updatedAdmin.email,
        status: updatedAdmin.status,
      },
    })
  },
)

export const deleteAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { uuid } = req.params
    const { reason } = req.body as BanAdminBody
    const { ipAddress, userAgent } = getClientMetadata(req)

    if (!reason || reason.trim().length === 0) {
      res
        .status(400)
        .json({ message: 'Reason is required for deleting an admin' })
      return
    }

    const admin = await prisma.user.findUnique({
      where: { uuid },
    })

    if (!admin || admin.role !== 'ADMIN') {
      res.status(404).json({ message: 'Admin not found' })
      return
    }

    await revokeAllUserSessions(admin.id)

    await prisma.user.delete({
      where: { uuid },
    })

    const supervisor = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    await logAudit(
      req,
      'DELETE_ADMIN_SUCCESS',
      `Supervisor deleted admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`,
      supervisor?.id,
    )

    const supervisorUser = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })

    if (supervisorUser) {
      await sendUserActionAlert(
        supervisorUser.email,
        `${supervisorUser.firstname} ${supervisorUser.lastname}`,
        admin.email,
        `${admin.firstname} ${admin.lastname}`,
        'DELETE_ADMIN',
        reason,
        `${req.user?.firstName} ${req.user?.lastName}`,
        ipAddress,
      )
    }

    res.status(200).json({
      success: true,
      message: 'Admin has been deleted',
    })
  },
)
