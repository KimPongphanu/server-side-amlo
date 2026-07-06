"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emergencyAction = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const session_1 = require("../middlewares/session");
const twoFactorService_1 = require("../services/twoFactorService");
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
/**
 * @ROUTE   POST /api/auth/emergency-action
 * @DESC    Supervisor uses another Supervisor's recovery key to BAN/DELETE/FORCE_RESET
 *          Used when the target supervisor account is compromised
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
exports.emergencyAction = (0, express_async_handler_1.default)(async (req, res) => {
    const { targetUuid, recoveryKey, action, reason } = req.body;
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    // 1. Validate required fields
    if (!targetUuid || !recoveryKey || !action || !reason) {
        res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        return;
    }
    if (!['BAN', 'DELETE', 'FORCE_RESET'].includes(action)) {
        res.status(400).json({ message: 'ประเภทการดำเนินการไม่ถูกต้อง' });
        return;
    }
    if (!reason.trim()) {
        res.status(400).json({ message: 'กรุณาระบุเหตุผล' });
        return;
    }
    // 2. Get current user (requester)
    const requester = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    if (!requester || requester.role !== 'SUPERVISOR') {
        res.status(403).json({ message: 'เฉพาะ Supervisor เท่านั้น' });
        return;
    }
    // 3. Get target user
    const target = await prisma_1.default.user.findUnique({
        where: { uuid: targetUuid },
    });
    if (!target || target.role !== 'SUPERVISOR') {
        res.status(404).json({ message: 'ไม่พบบัญชี Supervisor เป้าหมาย' });
        return;
    }
    if (target.uuid === requester.uuid) {
        res.status(400).json({ message: 'ไม่สามารถดำเนินการกับตนเองได้' });
        return;
    }
    // 4. Verify recovery key of the REQUESTER user
    const isValidKey = await (0, twoFactorService_1.verifyRecoveryKey)(requester.id, recoveryKey, req);
    if (!isValidKey) {
        await (0, auditLogger_1.logAudit)(req, 'EMERGENCY_ACTION_FAILED', `Supervisor ${requester.email} attempted emergency ${action} on ${target.email} but recovery key was invalid`, requester.id);
        res.status(400).json({ message: 'Recovery Key ไม่ถูกต้องหรือหมดอายุ' });
        return;
    }
    // 5. Disable 2FA on target (so the hacker can't use it anymore)
    await (0, twoFactorService_1.disableTOTPForUser)(target.id);
    // 6. Revoke all sessions of target
    await (0, session_1.revokeAllUserSessions)(target.id);
    // 7. Execute the action
    let actionDescription = '';
    switch (action) {
        case 'BAN':
            await prisma_1.default.user.update({
                where: { id: target.id },
                data: { status: 'Inactive' },
            });
            actionDescription = `Supervisor ${target.email} was banned via emergency recovery key`;
            break;
        case 'DELETE':
            await prisma_1.default.user.delete({
                where: { id: target.id },
            });
            actionDescription = `Supervisor ${target.email} was deleted via emergency recovery key`;
            break;
        case 'FORCE_RESET':
            await prisma_1.default.user.update({
                where: { id: target.id },
                data: { forcePasswordReset: true },
            });
            actionDescription = `Supervisor ${target.email} was force reset via emergency recovery key`;
            break;
    }
    await (0, auditLogger_1.logAudit)(req, 'EMERGENCY_ACTION_SUCCESS', `${actionDescription}. Reason: ${reason}. Executed by supervisor: ${requester.email}`, requester.id);
    res.status(200).json({
        success: true,
        message: 'ดำเนินการฉุกเฉินสำเร็จ',
        data: {
            action,
            target: target.email,
            targetUuid: target.uuid,
        },
    });
});
//# sourceMappingURL=emergencyController.js.map