"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBanner = exports.toggleBannerVisibility = exports.updateBanner = exports.reorderBanners = exports.createBanner = exports.getAllBanners = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const promises_1 = __importDefault(require("fs/promises"));
const fileValidator_1 = require("../utils/fileValidator");
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const AppError_1 = require("../utils/AppError");
// GET /api/banners — ดึงรายการ banners ทั้งหมด (เฉพาะ isShow = true สำหรับ public)
exports.getAllBanners = (0, express_async_handler_1.default)(async (req, res, next) => {
    const { all } = req.query;
    const where = all === 'true' ? {} : { isShow: true };
    const banners = await prisma_1.default.banners.findMany({
        where,
        orderBy: { order: 'asc' },
    });
    res.status(200).json({
        success: true,
        data: banners,
    });
});
// POST /api/banners — เพิ่ม banner ใหม่
exports.createBanner = (0, express_async_handler_1.default)(async (req, res, next) => {
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        const filePath = path_1.default.join(process.cwd(), file.path);
        await promises_1.default.unlink(filePath).catch(() => { });
        throw new AppError_1.AppError('ขนาดไฟล์ต้องไม่เกิน 5MB', 400);
    }
    const maxOrder = await prisma_1.default.banners.aggregate({
        _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;
    const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const link_url = typeof req.body.link_url === 'string' ? req.body.link_url.trim() : '';
    const newBanner = await prisma_1.default.banners.create({
        data: {
            image_url: `/uploads/${sanitizedFilename}`,
            title,
            link_url,
            order: nextOrder,
        },
    });
    res.status(201).json({
        success: true,
        data: newBanner,
    });
});
// PUT /api/banners/reorder — บันทึกลำดับใหม่
exports.reorderBanners = (0, express_async_handler_1.default)(async (req, res, next) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
        throw new AppError_1.AppError('ข้อมูลลำดับต้องเป็น array', 400);
    }
    if (orderedIds.length === 0) {
        throw new AppError_1.AppError('ข้อมูลลำดับไม่ถูกต้อง', 400);
    }
    if (!orderedIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
        throw new AppError_1.AppError('ข้อมูล ID ไม่ถูกต้อง', 400);
    }
    const existingBanners = await prisma_1.default.banners.findMany({
        where: { id: { in: orderedIds } },
        select: { id: true },
    });
    const existingIds = new Set(existingBanners.map((s) => s.id));
    const invalidIds = orderedIds.filter((id) => !existingIds.has(id));
    if (invalidIds.length > 0) {
        throw new AppError_1.AppError(`ไม่พบ Banner ID: ${invalidIds.join(', ')}`, 404);
    }
    await prisma_1.default.$transaction(orderedIds.map((id, index) => prisma_1.default.banners.update({
        where: { id },
        data: { order: index },
    })));
    res.status(200).json({
        success: true,
        message: 'บันทึกลำดับสำเร็จ',
    });
});
// PUT /api/banners/:id — อัปเดต title และ link_url
exports.updateBanner = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id) || id <= 0) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    const existing = await prisma_1.default.banners.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError_1.AppError('ไม่พบ Banner ที่ต้องการแก้ไข', 404);
    }
    const data = {};
    if (typeof req.body.title === 'string') {
        data.title = req.body.title.trim();
    }
    if (typeof req.body.link_url === 'string') {
        data.link_url = req.body.link_url.trim();
    }
    const updated = await prisma_1.default.banners.update({
        where: { id },
        data,
    });
    res.status(200).json({
        success: true,
        data: updated,
    });
});
// PATCH /api/banners/:id/toggle — เปิด/ปิด isShow
exports.toggleBannerVisibility = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id) || id <= 0) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    const existing = await prisma_1.default.banners.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError_1.AppError('ไม่พบ Banner ที่ต้องการแก้ไข', 404);
    }
    const updated = await prisma_1.default.banners.update({
        where: { id },
        data: { isShow: !existing.isShow },
    });
    res.status(200).json({
        success: true,
        data: updated,
    });
});
// DELETE /api/banners/:id — ลบ banner
exports.deleteBanner = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    const banner = await prisma_1.default.banners.findUnique({ where: { id } });
    if (!banner) {
        throw new AppError_1.AppError('ไม่พบ Banner ที่ต้องการลบ', 404);
    }
    if (banner.image_url) {
        const filePath = path_1.default.join(process.cwd(), banner.image_url);
        await promises_1.default.unlink(filePath).catch(() => { });
    }
    await prisma_1.default.banners.delete({ where: { id } });
    res.status(200).json({
        success: true,
        message: 'ลบ Banner สำเร็จ',
    });
});
//# sourceMappingURL=bannerController.js.map