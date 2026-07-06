"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdmin = exports.unbanAdmin = exports.banAdmin = exports.adminDelete = exports.adminUnban = exports.adminBan = exports.updateAdmin = exports.getAdminById = exports.getAdmins = exports.createAdmin = void 0;
// controllers/adminUserController.ts
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const confirmAction_1 = require("../middlewares/confirmAction");
const session_1 = require("../middlewares/session");
const emailService_1 = require("../services/emailService");
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
const validatePasswordStrength = (password, isSupervisor) => {
    if (isSupervisor) {
        if (password.length < 16) {
            return 'Supervisor password must be at least 16 characters';
        }
        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/;
        if (!strongRegex.test(password)) {
            return 'Supervisor password must contain uppercase, lowercase, number, and special character';
        }
    }
    else {
        if (password.length < 8) {
            return 'Password must be at least 8 characters';
        }
        const mediumRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!mediumRegex.test(password)) {
            return 'Password must contain uppercase, lowercase, and number';
        }
    }
    return null;
};
const addToPasswordHistory = async (userId, passwordHash) => {
    await prisma_1.default.passwordHistory.create({
        data: {
            userId,
            passwordHash,
        },
    });
};
exports.createAdmin = (0, express_async_handler_1.default)(async (req, res) => {
    const { email, password, firstname, lastname } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    if (!email || !password || !firstname || !lastname) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400).json({ message: 'Invalid email format' });
        return;
    }
    const domainMatch = email.match(/@(.+)$/);
    if (!domainMatch || !domainMatch[1].includes('go.th')) {
        res
            .status(400)
            .json({ message: 'Only organization email (.go.th) is allowed' });
        return;
    }
    const passwordError = validatePasswordStrength(password, false);
    if (passwordError) {
        res.status(400).json({ message: passwordError });
        return;
    }
    const existingUser = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (existingUser) {
        res.status(400).json({ message: 'Email already exists' });
        return;
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const newAdmin = await prisma_1.default.user.create({
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
    });
    await addToPasswordHistory(newAdmin.id, hashedPassword);
    const supervisor = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'CREATE_ADMIN_SUCCESS', `Supervisor created new admin: ${email.toLowerCase()} (Admin ID: ${newAdmin.id})`, supervisor?.id);
    const supervisorUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (supervisorUser) {
        await (0, emailService_1.sendUserActionAlert)(supervisorUser.email, `${supervisorUser.firstname} ${supervisorUser.lastname}`, newAdmin.email, `${newAdmin.firstname} ${newAdmin.lastname}`, 'CREATE_ADMIN', `New admin account created by supervisor`, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
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
    });
});
exports.getAdmins = (0, express_async_handler_1.default)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const where = { role: 'ADMIN' };
    const [admins, total] = await Promise.all([
        prisma_1.default.user.findMany({
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
        prisma_1.default.user.count({ where }),
    ]);
    res.status(200).json({
        success: true,
        count: admins.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: admins,
    });
});
exports.getAdminById = (0, express_async_handler_1.default)(async (req, res) => {
    const { uuid } = req.params;
    const admin = await prisma_1.default.user.findUnique({
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
    });
    if (!admin || admin.role !== 'ADMIN') {
        res.status(404).json({ message: 'Admin not found' });
        return;
    }
    res.status(200).json({
        success: true,
        data: admin,
    });
});
exports.updateAdmin = (0, express_async_handler_1.default)(async (req, res) => {
    const { uuid } = req.params;
    const { firstname, lastname } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const admin = await prisma_1.default.user.findUnique({
        where: { uuid },
    });
    if (!admin || admin.role !== 'ADMIN') {
        res.status(404).json({ message: 'Admin not found' });
        return;
    }
    const updateData = {};
    if (firstname)
        updateData.firstname = firstname.trim();
    if (lastname)
        updateData.lastname = lastname.trim();
    const updatedAdmin = await prisma_1.default.user.update({
        where: { uuid },
        data: updateData,
    });
    const supervisor = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_ADMIN_SUCCESS', `Supervisor updated admin: ${admin.email} (Admin ID: ${admin.id})`, supervisor?.id);
    res.status(200).json({
        success: true,
        message: 'Admin updated successfully',
        data: {
            uuid: updatedAdmin.uuid,
            email: updatedAdmin.email,
            firstname: updatedAdmin.firstname,
            lastname: updatedAdmin.lastname,
        },
    });
});
// @desc    Ban admin with 3-step confirmation
// @route   POST /api/admin/users/:id/ban
// @access  Super Admin
exports.adminBan = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3:
            await (0, confirmAction_1.step3ExecuteWithDelay)(req, res);
            break;
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
// @desc    Unban admin with 3-step confirmation
// @route   POST /api/admin/users/:id/unban
// @access  Super Admin
exports.adminUnban = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3:
            await (0, confirmAction_1.step3ExecuteWithDelay)(req, res);
            break;
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
// @desc    Delete admin with 3-step confirmation
// @route   POST /api/admin/users/:id/delete
// @access  Super Admin
exports.adminDelete = (0, express_async_handler_1.default)(async (req, res) => {
    const { step } = req.body;
    switch (step) {
        case 1:
            await (0, confirmAction_1.step1RequestConfirmation)(req, res);
            break;
        case 2:
            await (0, confirmAction_1.step2ConfirmWithReason)(req, res);
            break;
        case 3:
            await (0, confirmAction_1.step3ExecuteWithDelay)(req, res);
            break;
        default:
            res.status(400).json({
                success: false,
                message: 'Invalid step. Please provide step 1, 2, or 3.',
            });
    }
});
exports.banAdmin = (0, express_async_handler_1.default)(async (req, res) => {
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
                    .json({ message: 'Reason is required for banning an admin' });
                return;
            }
            const admin = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!admin || admin.role !== 'ADMIN') {
                res.status(404).json({ message: 'Admin not found' });
                return;
            }
            const updatedAdmin = await prisma_1.default.user.update({
                where: { uuid },
                data: { status: 'Inactive' },
            });
            await (0, session_1.revokeAllUserSessions)(admin.id);
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'BAN_ADMIN_SUCCESS', `Supervisor banned admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, admin.email, `${admin.firstname} ${admin.lastname}`, 'BAN_ADMIN', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'Admin has been banned',
                data: {
                    uuid: updatedAdmin.uuid,
                    email: updatedAdmin.email,
                    status: updatedAdmin.status,
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
exports.unbanAdmin = (0, express_async_handler_1.default)(async (req, res) => {
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
                    .json({ message: 'Reason is required for unbanning an admin' });
                return;
            }
            const admin = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!admin || admin.role !== 'ADMIN') {
                res.status(404).json({ message: 'Admin not found' });
                return;
            }
            const updatedAdmin = await prisma_1.default.user.update({
                where: { uuid },
                data: { status: 'Active' },
            });
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'UNBAN_ADMIN_SUCCESS', `Supervisor unbanned admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, admin.email, `${admin.firstname} ${admin.lastname}`, 'UNBAN_ADMIN', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'Admin has been unbanned',
                data: {
                    uuid: updatedAdmin.uuid,
                    email: updatedAdmin.email,
                    status: updatedAdmin.status,
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
exports.deleteAdmin = (0, express_async_handler_1.default)(async (req, res) => {
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
                    .json({ message: 'Reason is required for deleting an admin' });
                return;
            }
            const admin = await prisma_1.default.user.findUnique({
                where: { uuid },
            });
            if (!admin || admin.role !== 'ADMIN') {
                res.status(404).json({ message: 'Admin not found' });
                return;
            }
            await prisma_1.default.$transaction([
                prisma_1.default.session.deleteMany({ where: { userId: admin.id } }),
                prisma_1.default.user.delete({ where: { uuid } }),
            ]);
            const supervisor = await prisma_1.default.user.findUnique({
                where: { uuid: req.user?.uuid },
            });
            await (0, auditLogger_1.logAudit)(req, 'DELETE_ADMIN_SUCCESS', `Supervisor deleted admin: ${admin.email} (Admin ID: ${admin.id}). Reason: ${reason}`, supervisor?.id);
            if (supervisor) {
                await (0, emailService_1.sendUserActionAlert)(supervisor.email, `${supervisor.firstname} ${supervisor.lastname}`, admin.email, `${admin.firstname} ${admin.lastname}`, 'DELETE_ADMIN', reason, `${req.user?.firstName} ${req.user?.lastName}`, ipAddress);
            }
            res.status(200).json({
                success: true,
                message: 'Admin has been deleted',
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
//# sourceMappingURL=adminUserController.js.map