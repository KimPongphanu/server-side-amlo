"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceLogoutUser = exports.supervisorOTPAction = exports.updateMyProfile = exports.heartbeat = exports.deleteUser = exports.unbanUser = exports.banUser = exports.getUsers = exports.getMe = exports.logoutUser = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const confirmAction_1 = require("../middlewares/confirmAction");
const session_1 = require("../middlewares/session");
const emailService_1 = require("../services/emailService");
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
const addToPasswordHistory = async (userId, passwordHash) => {
    await prisma_1.default.passwordHistory.create({
        data: {
            userId,
            passwordHash,
        },
    });
};
exports.registerUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, password, firstname, lastname, role } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    // 1. Validate input data presence
    if (!email || !password || !firstname || !lastname) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    // Prevent oversized data inputs
    if (email.length > 100 ||
        password.length > 100 ||
        firstname.length > 50 ||
        lastname.length > 50) {
        res.status(400).json({ message: 'Input data exceeds maximum length.' });
        return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400).json({ message: 'Invalid email format.' });
        return;
    }
    // Enforce organization email (.go.th)
    const domainMatch = email.match(/@(.+)$/);
    if (!domainMatch || !domainMatch[1].includes('go.th')) {
        res
            .status(400)
            .json({ message: 'Only organization email (.go.th) is allowed' });
        return;
    }
    // Enforce strong password policy (allow special characters)
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
        res.status(400).json({
            message: 'Password must be at least 8 characters long, including uppercase, lowercase, and numbers.',
        });
        return;
    }
    // 2. Check for existing user
    const existingUser = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (existingUser) {
        res.status(400).json({ message: 'This email is already in use.' });
        return;
    }
    // Validate role: default to ADMIN, check supervisor limit
    const requestedRole = role === 'SUPERVISOR' ? 'SUPERVISOR' : 'ADMIN';
    if (requestedRole === 'SUPERVISOR') {
        const supervisorCount = await prisma_1.default.user.count({
            where: { role: 'SUPERVISOR' },
        });
        if (supervisorCount >= 2) {
            res.status(400).json({
                message: 'จำนวน Supervisor ครบ 2 ท่านแล้ว ไม่สามารถสร้างเพิ่มได้',
            });
            return;
        }
    }
    // 3. Hash password and save user
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.default.user.create({
        data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            role: requestedRole,
            twoFactorMethod: 'NONE',
            twoFactorEnabled: requestedRole === 'SUPERVISOR' ? false : false,
        },
    });
    await addToPasswordHistory(user.id, hashedPassword);
    const supervisor = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'CREATE_ADMIN_SUCCESS', `Supervisor created new admin: ${email.toLowerCase()} (Admin ID: ${user.id})`, supervisor?.id);
    if (supervisor) {
        await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, user.email, `${user.firstname} ${user.lastname}`, 'CREATE_ADMIN', `New admin account created by supervisor`, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
    }
    // 4. Return safe response
    res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: {
            id: user.uuid,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            role: user.role,
            createdAt: user.createdAt,
        },
    });
});
exports.loginUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const { email, password } = req.body;
    if (!email || !password || email.length > 100 || password.length > 100) {
        res.status(400).json({ message: 'Please provide valid credentials.' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    // === Failed Login Attempt Check ===
    let failedAttempt = await prisma_1.default.failedLoginAttempt.findFirst({
        where: { email: email.toLowerCase() },
    });
    if (failedAttempt && failedAttempt.lockedUntil && failedAttempt.lockedUntil > new Date()) {
        res.status(429).json({ message: 'บัญชีถูกระงับชั่วคราวเนื่องจากเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ในภายหลัง' });
        return;
    }
    if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
        if (failedAttempt) {
            const newAttempts = failedAttempt.attempts + 1;
            let lockedUntil = null;
            if (newAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 mins
            }
            await prisma_1.default.failedLoginAttempt.update({
                where: { id: failedAttempt.id },
                data: { attempts: newAttempts, lastAttempt: new Date(), lockedUntil }
            });
        }
        else {
            await prisma_1.default.failedLoginAttempt.create({
                data: {
                    email: email.toLowerCase(),
                    ipAddress,
                    attempts: 1,
                    userId: user ? user.id : null
                }
            });
        }
        await (0, auditLogger_1.logAudit)(req, 'LOGIN_FAILED', `Failed login attempt for email: ${email.slice(0, 50)} (Invalid credentials)`, user ? user.id : null);
        res.status(401).json({ message: 'Invalid email or password.' });
        return;
    }
    // Check if user account is banned
    if (user.status === 'Inactive') {
        await (0, auditLogger_1.logAudit)(req, 'LOGIN_FAILED', `Login attempt for banned account: ${email.slice(0, 50)}`, user.id);
        res
            .status(403)
            .json({ message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
        return;
    }
    // Clear failed attempts upon successful login
    if (failedAttempt) {
        await prisma_1.default.failedLoginAttempt.deleteMany({
            where: { email: email.toLowerCase() }
        });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('Server configuration error.');
    // 🌟 NEW: If user has 2FA enabled, issue temporary token instead of final token
    if (user.twoFactorEnabled && user.twoFactorMethod !== 'NONE') {
        const tempToken = jsonwebtoken_1.default.sign({
            userId: user.id,
            purpose: '2fa_verification',
        }, secret, { expiresIn: '5m' });
        res.cookie('temp_2fa_token', tempToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 5 * 60 * 1000,
            path: '/',
        });
        res.status(200).json({
            success: true,
            requires2FA: true,
            twoFactorMethod: user.twoFactorMethod,
            message: 'กรุณายืนยันตัวตนด้วย 2FA',
            user: {
                uuid: user.uuid,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                role: user.role,
            },
        });
        return;
    }
    // 🌟 Normal login flow (no 2FA)
    const token = jsonwebtoken_1.default.sign({
        uuid: user.uuid,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
    }, secret, { expiresIn: '1d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'strict' might block redirects
        maxAge: 24 * 60 * 60 * 1000,
        path: '/', // Ensure cookie is available for all paths
    });
    await (0, auditLogger_1.logAudit)(req, 'LOGIN_SUCCESS', 'User logged in successfully.', user.id);
    res.status(200).json({
        message: 'Login successful.',
        success: true,
        requires2FA: false,
        user: {
            uuid: user.uuid,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            role: user.role,
            forcePasswordReset: user.forcePasswordReset,
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorMethod: user.twoFactorMethod,
        },
    });
});
exports.logoutUser = (0, express_async_handler_1.default)(async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            await prisma_1.default.jwtBlacklist.create({ data: { token } });
        }
        catch (err) {
            if (err.code !== 'P2002') {
                throw err;
            }
        }
    }
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'LOGOUT', 'User logged out and token was blacklisted.', user?.id);
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
});
exports.getMe = (0, express_async_handler_1.default)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { uuid: req.user.uuid },
        select: {
            id: true,
            uuid: true,
            email: true,
            firstname: true,
            lastname: true,
            role: true,
            createdAt: true,
            recentOnline: true,
            forcePasswordReset: true,
            twoFactorEnabled: true,
            twoFactorMethod: true,
        },
    });
    if (!user) {
        res.status(404).json({ success: false, message: 'User account not found.' });
        return;
    }
    res.status(200).json({
        success: true,
        user: user,
    });
});
exports.getUsers = (0, express_async_handler_1.default)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        prisma_1.default.user.findMany({
            select: {
                uuid: true,
                firstname: true,
                lastname: true,
                email: true,
                role: true,
                status: true,
                twoFactorEnabled: true,
                twoFactorMethod: true,
                createdAt: true,
                recentOnline: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        }),
        prisma_1.default.user.count(),
    ]);
    res.status(200).json({
        success: true,
        count: users.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: users,
    });
});
exports.banUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3: {
            const { uuid } = req.params;
            const { reason } = req.body;
            if (!reason || reason.trim().length === 0) {
                res
                    .status(400)
                    .json({ message: 'Reason is required for banning a user' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            if (user.role === 'SUPERVISOR') {
                res.status(403).json({ message: 'Cannot ban supervisor account' });
                return;
            }
            const updatedUser = await prisma_1.default.user.update({
                where: { uuid },
                data: { status: 'Inactive' },
            });
            await (0, session_1.revokeAllUserSessions)(user.id);
            // ดึง supervisor ครั้งเดียว ใช้ร่วมทั้ง audit log และ email alert
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'BAN_USER_SUCCESS', `Supervisor banned user: ${user.email} (User ID: ${user.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, user.email, `${user.firstname} ${user.lastname}`, 'BAN_USER', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'User has been banned',
                data: {
                    uuid: updatedUser.uuid,
                    email: updatedUser.email,
                    status: updatedUser.status,
                },
            });
            break;
        }
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
exports.unbanUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3: {
            const { uuid } = req.params;
            const { reason } = req.body;
            if (!reason || reason.trim().length === 0) {
                res
                    .status(400)
                    .json({ message: 'Reason is required for unbanning a user' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            const updatedUser = await prisma_1.default.user.update({
                where: { uuid },
                data: { status: 'Active' },
            });
            // ดึง supervisor ครั้งเดียว ใช้ร่วมทั้ง audit log และ email alert
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'UNBAN_USER_SUCCESS', `Supervisor unbanned user: ${user.email} (User ID: ${user.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, user.email, `${user.firstname} ${user.lastname}`, 'UNBAN_USER', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'User has been unbanned',
                data: {
                    uuid: updatedUser.uuid,
                    email: updatedUser.email,
                    status: updatedUser.status,
                },
            });
            break;
        }
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
exports.deleteUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3: {
            const { uuid } = req.params;
            const { reason } = req.body;
            if (!reason || reason.trim().length === 0) {
                res
                    .status(400)
                    .json({ message: 'Reason is required for deleting a user' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            if (user.role === 'SUPERVISOR') {
                res.status(403).json({ message: 'Cannot delete supervisor account' });
                return;
            }
            await prisma_1.default.$transaction([
                prisma_1.default.session.deleteMany({ where: { userId: user.id } }),
                prisma_1.default.user.delete({ where: { uuid } }),
            ]);
            // ดึง supervisor ครั้งเดียว ใช้ร่วมทั้ง audit log และ email alert
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'DELETE_USER_SUCCESS', `Supervisor deleted user: ${user.email} (User ID: ${user.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, user.email, `${user.firstname} ${user.lastname}`, 'DELETE_USER', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'User has been deleted',
            });
            break;
        }
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
/**
 * @ROUTE   POST /api/auth/heartbeat
 * @DESC    อัปเดตเวลา recentOnline ของ User เพื่อบอกว่ายังออนไลน์อยู่ (ยิงทุก 5 นาทีจาก Frontend)
 * @ACCESS  Private (ต้องมี JWT Token ที่ถูกต้อง)
 */
exports.heartbeat = (0, express_async_handler_1.default)(async (req, res) => {
    await prisma_1.default.user.update({
        where: { uuid: req.user.uuid },
        data: { recentOnline: new Date() },
        select: { id: true },
    });
    res.status(200).json({ ok: true });
});
/**
 * @ROUTE   PUT /api/auth/me
 * @DESC    Update current user's firstname and lastname
 * @ACCESS  Authenticated (ADMIN or SUPERVISOR)
 */
exports.updateMyProfile = (0, express_async_handler_1.default)(async (req, res) => {
    const { firstname, lastname } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!firstname || !lastname) {
        res.status(400).json({ message: 'กรุณากรอกชื่อและนามสกุล' });
        return;
    }
    if (firstname.length > 50 || lastname.length > 50) {
        res.status(400).json({ message: 'ชื่อหรือนามสกุลยาวเกินไป' });
        return;
    }
    const updated = await prisma_1.default.user.update({
        where: { uuid: req.user?.uuid },
        select: {
            uuid: true,
            email: true,
            firstname: true,
            lastname: true,
            role: true,
        },
        data: {
            firstname: firstname.trim(),
            lastname: lastname.trim(),
        },
    });
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_PROFILE_SUCCESS', `User ${updated.email} updated their profile`, undefined);
    res.status(200).json({
        success: true,
        message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ',
        data: updated,
    });
});
/**
 * @ROUTE   POST /api/auth/users/:uuid/otp-action
 * @DESC    Supervisor uses own OTP (2FA) to unban another Supervisor
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
exports.supervisorOTPAction = (0, express_async_handler_1.default)(async (req, res) => {
    const { uuid } = req.params;
    const { otpToken, reason } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!otpToken || !reason || !reason.trim()) {
        res.status(400).json({ message: 'กรุณากรอก OTP และเหตุผล' });
        return;
    }
    // 1. Get current user (requester)
    const requester = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!requester || requester.role !== 'SUPERVISOR') {
        res.status(403).json({ message: 'เฉพาะ Supervisor เท่านั้น' });
        return;
    }
    // 2. Get target user (must be SUPERVISOR)
    const target = await prisma_1.default.user.findUnique({
        where: { uuid },
    });
    if (!target || target.role !== 'SUPERVISOR') {
        res.status(404).json({ message: 'ไม่พบบัญชี Supervisor เป้าหมาย' });
        return;
    }
    if (target.uuid === requester.uuid) {
        res.status(400).json({ message: 'ไม่สามารถดำเนินการกับตนเองได้' });
        return;
    }
    // 3. Check target is banned (only unban allowed)
    if (target.status !== 'Inactive') {
        res.status(400).json({ message: 'สมาชิกนี้ยังไม่ได้ถูกระงับ' });
        return;
    }
    // 4. Verify OTP of the REQUESTER (current user)
    if (!requester.twoFactorSecret) {
        res.status(400).json({ message: 'คุณยังไม่ได้ตั้งค่า 2FA' });
        return;
    }
    const isValidOTP = speakeasy_1.default.totp.verify({
        secret: requester.twoFactorSecret,
        encoding: 'base32',
        token: otpToken,
        window: 1,
    });
    if (!isValidOTP) {
        await (0, auditLogger_1.logAudit)(req, 'OTP_ACTION_FAILED', `Supervisor ${requester.email} attempted to unban ${target.email} but OTP was invalid`, requester.id);
        res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
        return;
    }
    // 5. Execute unban
    await prisma_1.default.user.update({
        where: { id: target.id },
        data: { status: 'Active' },
    });
    // 6. Revoke all sessions of target (force logout)
    await (0, session_1.revokeAllUserSessions)(target.id);
    await (0, auditLogger_1.logAudit)(req, 'OTP_ACTION_UNBAN_SUCCESS', `Supervisor ${requester.email} unbanned ${target.email} via OTP. Reason: ${reason}`, requester.id);
    res.status(200).json({
        success: true,
        message: 'ปลดระงับการใช้งานสำเร็จ',
        data: {
            action: 'unban',
            target: target.email,
        },
    });
});
/**
 * @ROUTE   POST /api/auth/users/:uuid/force-logout
 * @DESC    Supervisor uses own OTP to force logout another user by revoking all sessions
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
exports.forceLogoutUser = (0, express_async_handler_1.default)(async (req, res) => {
    const { uuid } = req.params;
    const { otpToken, reason } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!otpToken || !reason || !reason.trim()) {
        res.status(400).json({ message: 'กรุณากรอก OTP และเหตุผล' });
        return;
    }
    // 1. Get current user (requester)
    const requester = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!requester || requester.role !== 'SUPERVISOR') {
        res.status(403).json({ message: 'เฉพาะ Supervisor เท่านั้น' });
        return;
    }
    // 2. Get target user
    const target = await prisma_1.default.user.findUnique({
        where: { uuid },
    });
    if (!target) {
        res.status(404).json({ message: 'ไม่พบบัญชีผู้ใช้เป้าหมาย' });
        return;
    }
    if (target.uuid === requester.uuid) {
        res.status(400).json({ message: 'ไม่สามารถดำเนินการกับตนเองได้' });
        return;
    }
    // 3. Verify OTP of the REQUESTER
    if (!requester.twoFactorSecret) {
        res.status(400).json({ message: 'คุณยังไม่ได้ตั้งค่า 2FA' });
        return;
    }
    const isValidOTP = speakeasy_1.default.totp.verify({
        secret: requester.twoFactorSecret,
        encoding: 'base32',
        token: otpToken,
        window: 1,
    });
    if (!isValidOTP) {
        await (0, auditLogger_1.logAudit)(req, 'FORCE_LOGOUT_FAILED', `Supervisor ${requester.email} attempted to force logout ${target.email} but OTP was invalid`, requester.id);
        res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
        return;
    }
    // 4. Revoke all sessions (force logout)
    await (0, session_1.revokeAllUserSessions)(target.id);
    await (0, auditLogger_1.logAudit)(req, 'FORCE_LOGOUT_SUCCESS', `Supervisor ${requester.email} force logged out ${target.email}. Reason: ${reason}`, requester.id);
    res.status(200).json({
        success: true,
        message: 'บังคับออกจากระบบสำเร็จ',
        data: {
            target: target.email,
            sessionsRevoked: true,
        },
    });
});
//# sourceMappingURL=authController.js.map