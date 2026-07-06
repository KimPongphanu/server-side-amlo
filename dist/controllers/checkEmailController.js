"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEmail = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.checkEmail = (0, express_async_handler_1.default)(async (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
        res.status(400).json({ message: 'Email is required' });
        return;
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { role: true },
    });
    if (!user) {
        res.status(200).json({
            found: false,
            message: 'ไม่พบอีเมลนี้ในระบบ',
        });
        return;
    }
    res.status(200).json({
        found: true,
        role: user.role, // 'ADMIN' | 'SUPERVISOR' | 'USER'
    });
});
//# sourceMappingURL=checkEmailController.js.map