// controllers/adminUserController.ts
import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import {
  step1RequestConfirmation,
  step2ConfirmWithReason,
  step3ExecuteWithDelay,
} from '../middlewares/confirmAction'
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
        forcePasswordReset: true,
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
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const where = { role: 'ADMIN' }

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    res.status(200).json({
      success: true,
      count: admins.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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

// @desc    Ban admin with 3-step confirmation
// @route   POST /api/admin/users/:id/ban
// @access  Super Admin
export const adminBan = asyncHandler(async (req: Request, res: Response) => {
  const { step } = req.body

  switch (step) {
    case 1:
      await step1RequestConfirmation(req, res)
      break
    case 2:
      await step2ConfirmWithReason(req, res)
      break
    case 3:
      await step3ExecuteWithDelay(req, res)
      break
    default:
      res.status(400).json({
        success: false,
        message: 'Invalid step. Please provide step 1, 2, or 3.',
      })
  }
})

// @desc    Unban admin with 3-step confirmation
// @route   POST /api/admin/users/:id/unban
// @access  Super Admin
export const adminUnban = asyncHandler(async (req: Request, res: Response) => {
  const { step } = req.body

  switch (step) {
    case 1:
      await step1RequestConfirmation(req, res)
      break
    case 2:
      await step2ConfirmWithReason(req, res)
      break
    case 3:
      await step3ExecuteWithDelay(req, res)
      break
    default:
      res.status(400).json({
        success: false,
        message: 'Invalid step. Please provide step 1, 2, or 3.',
      })
  }
})

// @desc    Delete admin with 3-step confirmation
// @route   POST /api/admin/users/:id/delete
// @access  Super Admin
export const adminDelete = asyncHandler(async (req: Request, res: Response) => {
  const { step } = req.body

  switch (step) {
    case 1:
      await step1RequestConfirmation(req, res)
      break
    case 2:
      await step2ConfirmWithReason(req, res)
      break
    case 3:
      await step3ExecuteWithDelay(req, res)
      break
    default:
      res.status(400).json({
        success: false,
        message: 'Invalid step. Please provide step 1, 2, or 3.',
      })
  }
})

export const banAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { step } = req.body
    const { ipAddress, userAgent } = getClientMetadata(req)

    switch (step) {
      case 1:
        await step1RequestConfirmation(req, res)
        break
      case 2:
        await step2ConfirmWithReason(req, res)
        break
      case 3: {
        const { uuid } = req.params
        const { reason } = req.body as BanAdminBody

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

        if (supervisor) {
          await sendUserActionAlert(
            supervisor.email,
            `${supervisor.firstname} ${supervisor.lastname}`,
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
        break
      }
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid step. Please provide step 1, 2, or 3.',
        })
    }
  },
)

export const unbanAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { step } = req.body
    const { ipAddress, userAgent } = getClientMetadata(req)

    switch (step) {
      case 1:
        await step1RequestConfirmation(req, res)
        break
      case 2:
        await step2ConfirmWithReason(req, res)
        break
      case 3: {
        const { uuid } = req.params
        const { reason } = req.body as BanAdminBody

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

        if (supervisor) {
          await sendUserActionAlert(
            supervisor.email,
            `${supervisor.firstname} ${supervisor.lastname}`,
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
        break
      }
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid step. Please provide step 1, 2, or 3.',
        })
    }
  },
)

export const deleteAdmin = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { step } = req.body
    const { ipAddress, userAgent } = getClientMetadata(req)

    switch (step) {
      case 1:
        await step1RequestConfirmation(req, res)
        break
      case 2:
        await step2ConfirmWithReason(req, res)
        break
      case 3: {
        const { uuid } = req.params
        const { reason } = req.body as BanAdminBody

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

        await prisma.$transaction([
          prisma.session.deleteMany({ where: { userId: admin.id } }),
          prisma.user.delete({ where: { uuid } }),
        ])

        const supervisor = await prisma.user.findUnique({
          where: { uuid: req.user?.uuid },
        })

        await logAudit(
          req,
          'DELETE_ADMIN_SUCCESS',
          `Supervisor deleted admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`,
          supervisor?.id,
        )

        if (supervisor) {
          await sendUserActionAlert(
            supervisor.email,
            `${supervisor.firstname} ${supervisor.lastname}`,
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
        break
      }
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid step. Please provide step 1, 2, or 3.',
        })
    }
  },
)
