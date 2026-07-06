"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePopup = exports.updatePopup = exports.createPopup = exports.getActivePopup = exports.getAllPopups = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const promises_1 = __importDefault(require("fs/promises"));
const fileValidator_1 = require("../utils/fileValidator");
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const AppError_1 = require("../utils/AppError");
// GET /api/splash-popups — ดึงทั้งหมด (admin)
exports.getAllPopups = (0, express_async_handler_1.default)(async (req, res, next) => {
    const popups = await prisma_1.default.splash_popups.findMany({
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: popups });
});
// GET /api/splash-popups/active — ดึง popup ที่ active อยู่ (public)
exports.getActivePopup = (0, express_async_handler_1.default)(async (req, res, next) => {
    const popup = await prisma_1.default.splash_popups.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: popup || null });
});
// POST /api/splash-popups — สร้าง popup ใหม่
exports.createPopup = (0, express_async_handler_1.default)(async (req, res, next) => {
    const file = req.file;
    if (!file) {
        throw new AppError_1.AppError('กรุณาอัปโหลดรูปภาพ', 400);
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        const filePath = path_1.default.join(process.cwd(), file.path);
        await promises_1.default.unlink(filePath).catch(() => { });
        throw new AppError_1.AppError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP เท่านั้น', 400);
    }
    const filePath = path_1.default.join(process.cwd(), file.path);
    const isValidFile = await (0, fileValidator_1.validateMagicBytes)(filePath, file.mimetype);
    if (!isValidFile) {
        await promises_1.default.unlink(filePath).catch(() => { });
        throw new AppError_1.AppError('ไฟล์รูปภาพไม่ถูกต้องหรืออาจเป็นไฟล์อันตรายแฝงตัวมา', 400);
    }
    const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const popup = await prisma_1.default.splash_popups.create({
        data: {
            image_url: `/uploads/${sanitizedFilename}`,
            title,
        },
    });
    res.status(201).json({ success: true, data: popup });
});
// PUT /api/splash-popups/:id — อัปเดต popup (activate, deactivate, title)
exports.updatePopup = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id) || id <= 0) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    const existing = await prisma_1.default.splash_popups.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError_1.AppError('ไม่พบ Popup', 404);
    }
    const data = {};
    if (typeof req.body.title === 'string') {
        data.title = req.body.title.trim();
    }
    if (typeof req.body.isActive === 'boolean') {
        // ถ้าต้องการ activate ตัวนี้ ให้ deactivate ตัวอื่นก่อน
        if (req.body.isActive) {
            await prisma_1.default.splash_popups.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            });
        }
        data.isActive = req.body.isActive;
    }
    const updated = await prisma_1.default.splash_popups.update({
        where: { id },
        data,
    });
    res.status(200).json({ success: true, data: updated });
});
// DELETE /api/splash-popups/:id — ลบ popup
exports.deletePopup = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id) || id <= 0) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    const popup = await prisma_1.default.splash_popups.findUnique({ where: { id } });
    if (!popup) {
        throw new AppError_1.AppError('ไม่พบ Popup', 404);
    }
    if (popup.image_url) {
        const filePath = path_1.default.join(process.cwd(), popup.image_url);
        await promises_1.default.unlink(filePath).catch(() => { });
    }
    await prisma_1.default.splash_popups.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'ลบ Popup สำเร็จ' });
});
//# sourceMappingURL=splashPopupController.js.map