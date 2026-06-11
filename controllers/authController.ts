import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'
import asyncHandler from 'express-async-handler'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middlewares/auth'
import { logAudit } from '../utils/auditLogger'
import { getClientMetadata } from '../utils/ipSelector'

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password, firstname, lastname } = req.body

    // 1. Validate input data presence
    if (!email || !password || !firstname || !lastname) {
      res.status(400).json({ message: 'Please provide all required fields.' })
      return
    }

    // Prevent oversized data inputs
    if (
      email.length > 100 ||
      password.length > 100 ||
      firstname.length > 50 ||
      lastname.length > 50
    ) {
      res.status(400).json({ message: 'Input data exceeds maximum length.' })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: 'Invalid email format.' })
      return
    }

    // Enforce strong password policy
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/
    if (!strongPasswordRegex.test(password)) {
      res.status(400).json({
        message:
          'Password must be at least 8 characters long, including uppercase, lowercase, and numbers.',
      })
      return
    }

    // 2. Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      res.status(400).json({ message: 'This email is already in use.' })
      return
    }

    // 3. Hash password and save user
    const hashedPassword = await bcrypt.hash(password, 10)

    // ป้องกัน Mass Assignment โดยใส่เฉพาะฟิลด์ที่อนุญาต (role ปล่อยเป็นค่าเริ่มต้น USER จาก Schema)
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstname, lastname },
    })

    // 4. Return safe response
    res.status(201).json({
      message: 'Registration successful.',
      userRef: user.uuid,
    })
  },
)

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { ipAddress, userAgent } = getClientMetadata(req)
  const { email, password } = req.body

  if (!email || !password || email.length > 100 || password.length > 100) {
    res.status(400).json({ message: 'Please provide valid credentials.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Case 1: Invalid email or password (Login Failed)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    await logAudit(
      req,
      'LOGIN_FAILED',
      `Failed login attempt for email: ${email.slice(0, 50)} (Invalid credentials)`,
      user ? user.id : null,
    )
    res.status(401).json({ message: 'Invalid email or password.' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Server configuration error.')

  // Generate JWT Token (สามารถแนบ role ลงไปใน token ได้เพื่อการเช็คฝั่ง Client)
  const token = jwt.sign(
    {
      uuid: user.uuid,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: user.role, // <-- แก้ไขให้ใช้สิทธิ์จากฐานข้อมูลจริง
    },
    secret,
    { expiresIn: '1d' },
  )

  // Set JWT in HTTP-Only Cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  })

  // Case 2: Login successful
  await logAudit(req, 'LOGIN_SUCCESS', 'User logged in successfully.', user.id)

  res.status(200).json({
    message: 'Login successful.',
    success: true,
    user: {
      uuid: user.uuid,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role, // <-- แก้ไขให้ดึงสิทธิ์จากฐานข้อมูลจริง ไม่ Hardcode 'Admin'
    },
  })
})

export const logoutUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const token = req.cookies.token

    if (token) {
      await prisma.jwtBlacklist.create({ data: { token } }).catch(console.error)
    }

    const user = await prisma.user.findUnique({
      where: { uuid: req.user?.uuid },
    })
    await logAudit(
      req,
      'LOGOUT',
      'User logged out and token was blacklisted.',
      user?.id,
    )

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })

    res.status(200).json({ success: true, message: 'Logged out successfully.' })
  },
)

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { uuid: req.user.uuid },
    select: {
      id: true,
      uuid: true,
      email: true,
      firstname: true,
      lastname: true,
      role: true, // <-- ดึงฟิลด์ role ออกมาจาก DB
      createdAt: true,
      recentOnline: true,
    },
  })

  if (!user) {
    res.status(404).json({ success: false, message: 'User account not found.' })
    return
  }

  res.status(200).json({
    success: true,
    user: user, // <-- ส่งตัวแปร user ตรงๆ โดยไม่ต้อง Hardcode ครอบทับสิทธิ์อีกรอบ
  })
})

export const getUsers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        uuid: true,
        firstname: true, // <-- แก้ไขจาก username เป็น firstname เพื่อให้ตรงกับ Schema
        lastname: true, // <-- ดึงนามสกุลมาแสดงผลคู่กัน
        email: true,
        role: true, // <-- ดึงสิทธิ์ที่พึ่งอัปเดตจาก DB ออกมาใช้งาน
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    })
  },
)
