"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepartment = exports.deleteDepartment = exports.getDepartments = exports.createDepartment = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const fileValidator_1 = require("../utils/fileValidator");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auditLogger_1 = require("../utils/auditLogger");
const ipSelector_1 = require("../utils/ipSelector");
exports.createDepartment = (0, express_async_handler_1.default)(async (req, res) => {
    const { ipAddress, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const { title, content, galleryUrls } = req.body;
    const files = req.files;
    if (!title) {
        res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' });
        return;
    }
    if (title.length > 150) {
        res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' });
        return;
    }
    if (!files || !files['cover_image']) {
        res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพปก (cover_image)' });
        return;
    }
    const sanitizedContent = content ? isomorphic_dompurify_1.default.sanitize(content) : null;
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
    ];
    const allFiles = [...files['cover_image'], ...(files['gallery'] || [])];
    for (const file of allFiles) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` });
            const filePath = path_1.default.join(process.cwd(), file.path);
            await promises_1.default.unlink(filePath).catch(() => { });
            return;
        }
        const filePath = path_1.default.join(process.cwd(), file.path);
        const isValid = await (0, fileValidator_1.validateMagicBytes)(filePath, file.mimetype);
        if (!isValid) {
            res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่ถูกต้องหรือเป็นไฟล์อันตราย` });
            await promises_1.default.unlink(filePath).catch(() => { });
            return;
        }
    }
    const youtubeRegex = /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/;
    const rawUrls = Array.isArray(galleryUrls)
        ? galleryUrls
        : galleryUrls
            ? [galleryUrls]
            : [];
    for (const url of rawUrls) {
        if (!youtubeRegex.test(url)) {
            res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` });
            return;
        }
    }
    const coverImagePath = `/uploads/${files['cover_image'][0].filename}`;
    const galleryData = [
        ...(files['gallery'] || []).map((file) => ({
            url: `/uploads/${file.filename}`,
            type: file.mimetype.startsWith('video/')
                ? 'VIDEO'
                : 'IMAGE',
        })),
        ...rawUrls.map((url) => ({ url, type: 'VIDEO' })),
    ];
    const department = await prisma_1.default.department.create({
        data: {
            title,
            content: sanitizedContent,
            cover_image: coverImagePath,
            GalleryItem: { create: galleryData },
        },
        include: { GalleryItem: true },
    });
    const formattedDepartment = {
        ...department,
        gallery: department.GalleryItem.map((g) => ({
            ...g,
            type: g.type.toLowerCase(),
        })),
    };
    const adminUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'CREATE_DEPARTMENT_SUCCESS', `Admin created a new department: "${title.trim()}" (Department ID: ${department.id}, Total media items: ${galleryData.length})`, adminUser?.id);
    res
        .status(201)
        .json({ message: 'สร้างภาควิชาสำเร็จ', data: formattedDepartment });
});
exports.getDepartments = (0, express_async_handler_1.default)(async (req, res) => {
    const departments = await prisma_1.default.department.findMany({
        where: { isDelete: false },
        include: {
            GalleryItem: {
                select: { id: true, type: true, url: true, departmentId: true },
            },
        },
    });
    const formattedDepartments = departments.map((d) => ({
        ...d,
        gallery: d.GalleryItem.map((g) => ({
            ...g,
            type: g.type.toLowerCase(),
        })),
    }));
    res.status(200).json(formattedDepartments);
});
exports.deleteDepartment = (0, express_async_handler_1.default)(async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ message: 'ID ไม่ถูกต้อง' });
        return;
    }
    const targetDept = await prisma_1.default.department.findUnique({ where: { id } });
    if (!targetDept) {
        res.status(404).json({ message: 'ไม่พบข้อมูลหน่วยงานที่ต้องการลบ' });
        return;
    }
    await prisma_1.default.department.update({
        where: { id },
        data: { isDelete: true },
    });
    const adminUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'DELETE_DEPARTMENT_SUCCESS', `Admin performed a soft delete on department: "${targetDept.title}" (Department ID: ${id})`, adminUser?.id);
    res.status(200).json({ message: 'ลบหน่วยงานสำเร็จ' });
});
exports.updateDepartment = (0, express_async_handler_1.default)(async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ message: 'ID ไม่ถูกต้อง' });
        return;
    }
    const { title, content, galleryUrls, existingGalleryUrls, isGalleryUpdated, } = req.body;
    const files = req.files;
    if (!title) {
        res.status(400).json({ message: 'กรุณากรอกหัวข้อภาควิชา' });
        return;
    }
    if (title.length > 150) {
        res.status(400).json({ message: 'หัวข้อยาวเกินกำหนด' });
        return;
    }
    const existingDept = await prisma_1.default.department.findUnique({ where: { id } });
    if (!existingDept) {
        res.status(404).json({ message: 'ไม่พบหน่วยงานที่ต้องการแก้ไข' });
        return;
    }
    const sanitizedContent = content ? isomorphic_dompurify_1.default.sanitize(content) : null;
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
    ];
    const allFiles = [
        ...(files?.['cover_image'] || []),
        ...(files?.['gallery'] || []),
    ];
    for (const file of allFiles) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่รองรับ` });
            const filePath = path_1.default.join(process.cwd(), file.path);
            await promises_1.default.unlink(filePath).catch(() => { });
            return;
        }
        const filePath = path_1.default.join(process.cwd(), file.path);
        const isValid = await (0, fileValidator_1.validateMagicBytes)(filePath, file.mimetype);
        if (!isValid) {
            res.status(400).json({ message: `ไฟล์ ${file.originalname} ไม่ถูกต้องหรือเป็นไฟล์อันตราย` });
            await promises_1.default.unlink(filePath).catch(() => { });
            return;
        }
    }
    let coverImagePath = existingDept.cover_image;
    if (files?.['cover_image']) {
        coverImagePath = `/uploads/${files['cover_image'][0].filename}`;
    }
    let galleryUpdateData = undefined;
    if (isGalleryUpdated === 'true') {
        const youtubeRegex = /^https?:\/\/(?:youtu\.be\/|www\.youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/;
        const rawUrls = Array.isArray(galleryUrls)
            ? galleryUrls
            : galleryUrls
                ? [galleryUrls]
                : [];
        const rawExistingUrls = Array.isArray(existingGalleryUrls)
            ? existingGalleryUrls
            : existingGalleryUrls
                ? [existingGalleryUrls]
                : [];
        for (const url of rawUrls) {
            if (!youtubeRegex.test(url)) {
                res.status(400).json({ message: `YouTube URL ไม่ถูกต้อง: ${url}` });
                return;
            }
        }
        galleryUpdateData = {
            deleteMany: {},
            create: [
                ...rawExistingUrls.map((url) => ({ url, type: 'IMAGE' })),
                ...(files?.['gallery'] || []).map((file) => ({
                    url: `/uploads/${file.filename}`,
                    type: file.mimetype.startsWith('video/')
                        ? 'VIDEO'
                        : 'IMAGE',
                })),
                ...rawUrls.map((url) => ({ url, type: 'VIDEO' })),
            ],
        };
    }
    const updatedDept = await prisma_1.default.department.update({
        where: { id },
        data: {
            title,
            content: sanitizedContent,
            cover_image: coverImagePath,
            ...(galleryUpdateData && { GalleryItem: galleryUpdateData }),
        },
        include: { GalleryItem: true },
    });
    const formattedDepartment = {
        ...updatedDept,
        gallery: updatedDept.GalleryItem.map((g) => ({
            ...g,
            type: g.type.toLowerCase(),
        })),
    };
    const adminUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_DEPARTMENT_SUCCESS', `Admin updated department: "${existingDept.title}" -> "${title.trim()}" (Department ID: ${id})`, adminUser?.id);
    res
        .status(200)
        .json({ message: 'แก้ไขหน่วยงานสำเร็จ', data: formattedDepartment });
});
//# sourceMappingURL=departmentController.js.map