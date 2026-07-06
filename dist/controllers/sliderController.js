"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSlide = exports.reorderSlides = exports.createSlide = exports.getAllSlides = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const promises_1 = __importDefault(require("fs/promises"));
const fileValidator_1 = require("../utils/fileValidator");
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const AppError_1 = require("../utils/AppError"); // ถ้ามี custom error class
// GET /api/slider - ดึงรายการสไลด์ทั้งหมด
exports.getAllSlides = (0, express_async_handler_1.default)(async (req, res, next) => {
    const slides = await prisma_1.default.slider_images.findMany({
        orderBy: { order: 'asc' },
    });
    res.status(200).json({
        success: true,
        data: slides,
    });
});
// POST /api/slider - เพิ่มรูปภาพใหม่
exports.createSlide = (0, express_async_handler_1.default)(async (req, res, next) => {
    const file = req.file;
    if (!file) {
        throw new AppError_1.AppError('กรุณาอัปโหลดรูปภาพ', 400);
    }
    // OWASP: Validate file type
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
    // OWASP: Validate file size (เพิ่มเติมจาก multer limits)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        const filePath = path_1.default.join(process.cwd(), file.path);
        await promises_1.default.unlink(filePath).catch(() => { });
        throw new AppError_1.AppError('ขนาดไฟล์ต้องไม่เกิน 5MB', 400);
    }
    // หา order ล่าสุด
    const maxOrder = await prisma_1.default.slider_images.aggregate({
        _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;
    // OWASP: Sanitize filename before saving
    const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const newSlide = await prisma_1.default.slider_images.create({
        data: {
            image_url: `/uploads/${sanitizedFilename}`,
            order: nextOrder,
        },
    });
    res.status(201).json({
        success: true,
        data: newSlide,
    });
});
// PUT /api/slider/reorder - บันทึกลำดับใหม่
exports.reorderSlides = (0, express_async_handler_1.default)(async (req, res, next) => {
    const { orderedIds } = req.body;
    // OWASP: Input validation
    if (!Array.isArray(orderedIds)) {
        throw new AppError_1.AppError('ข้อมูลลำดับต้องเป็น array', 400);
    }
    if (orderedIds.length === 0) {
        throw new AppError_1.AppError('ข้อมูลลำดับไม่ถูกต้อง', 400);
    }
    // OWASP: Validate array elements
    if (!orderedIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
        throw new AppError_1.AppError('ข้อมูล ID ไม่ถูกต้อง', 400);
    }
    // ตรวจสอบว่า ID ทั้งหมดมีอยู่จริง
    const existingSlides = await prisma_1.default.slider_images.findMany({
        where: {
            id: {
                in: orderedIds,
            },
        },
        select: { id: true },
    });
    // ระบุ type ให้ชัดเจน
    const existingIds = new Set(existingSlides.map((s) => s.id));
    const invalidIds = orderedIds.filter((id) => !existingIds.has(id));
    if (invalidIds.length > 0) {
        throw new AppError_1.AppError(`ไม่พบสไลด์ ID: ${invalidIds.join(', ')}`, 404);
    }
    // Transaction เพื่อความปลอดภัยของข้อมูล
    await prisma_1.default.$transaction(orderedIds.map((id, index) => prisma_1.default.slider_images.update({
        where: { id },
        data: { order: index },
    })));
    res.status(200).json({
        success: true,
        message: 'บันทึกลำดับสำเร็จ',
    });
});
// DELETE /api/slider/:id - ลบสไลด์
exports.deleteSlide = (0, express_async_handler_1.default)(async (req, res, next) => {
    const id = parseInt(String(req.params.id), 10);
    // OWASP: Validate ID parameter
    if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
        throw new AppError_1.AppError('ID ไม่ถูกต้อง', 400);
    }
    // ตรวจสอบว่ามีสไลด์นี้อยู่จริง
    const slide = await prisma_1.default.slider_images.findUnique({
        where: { id },
    });
    if (!slide) {
        throw new AppError_1.AppError('ไม่พบสไลด์ที่ต้องการลบ', 404);
    }
    // ลบไฟล์รูปภาพออกจาก storage
    if (slide.image_url) {
        const filePath = path_1.default.join(process.cwd(), slide.image_url);
        await promises_1.default.unlink(filePath).catch(() => {
            // ไม่ throw error ถ้าลบไฟล์ไม่สำเร็จ เพราะอาจไม่มีไฟล์อยู่แล้ว
        });
    }
    await prisma_1.default.slider_images.delete({
        where: { id },
    });
    res.status(200).json({
        success: true,
        message: 'ลบสไลด์สำเร็จ',
    });
});
//# sourceMappingURL=sliderController.js.map