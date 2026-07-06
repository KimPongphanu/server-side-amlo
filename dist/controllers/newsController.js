"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNews = exports.getNews = exports.createNews = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auditLogger_1 = require("../utils/auditLogger");
exports.createNews = (0, express_async_handler_1.default)(async (req, res) => {
    const { title, description, content, type } = req.body;
    if (!title || !description) {
        res.status(400).json({ message: 'กรุณากรอกหัวข้อและรายละเอียดสั้น' });
        return;
    }
    if (title.length > 150 || description.length > 500) {
        res.status(400).json({ message: 'ตัวอักษรมีความยาวเกินกำหนด' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพหน้าปกข่าว' });
        return;
    }
    // 🌟 Sanitize เนื้อหา HTML ก่อนนำไปใช้งาน
    const sanitizedContent = content ? isomorphic_dompurify_1.default.sanitize(content) : null;
    const imagePath = `/uploads/${req.file.filename}`;
    const news = await prisma_1.default.news.create({
        data: {
            type: type === 'PR' ? 'PR' : 'NEWS',
            title,
            description,
            content: sanitizedContent,
            image_src: imagePath,
        },
    });
    const adminUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'CREATE_NEWS_SUCCESS', `Admin created a new news/event: "${title.trim()}" (ID: ${news.id}, Type: ${news.type})`, adminUser?.id);
    res.status(201).json({ message: 'สร้างข่าวสารสำเร็จ', newsRef: news.id });
});
exports.getNews = (0, express_async_handler_1.default)(async (req, res) => {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const type = String(req.query.type);
    const isAll = req.query.all === 'true';
    const skip = (page - 1) * limit;
    const whereCondition = {};
    if (!isAll) {
        whereCondition.isShow = true;
    }
    if (type === 'PR' || type === 'NEWS') {
        whereCondition.type = type;
    }
    const [newsList, totalItems] = await prisma_1.default.$transaction([
        prisma_1.default.news.findMany({
            where: whereCondition,
            orderBy: { date: 'desc' },
            skip: skip,
            take: limit,
        }),
        prisma_1.default.news.count({ where: whereCondition }),
    ]);
    res.status(200).json({
        success: true,
        data: newsList,
        pagination: {
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        },
    });
});
exports.updateNews = (0, express_async_handler_1.default)(async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' });
        return;
    }
    const { title, description, content, isShow, views, type, date } = req.body;
    const oldNews = await prisma_1.default.news.findUnique({ where: { id } });
    if (!oldNews) {
        res
            .status(404)
            .json({ success: false, message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
        return;
    }
    // 🌟 Sanitize เนื้อหาตอนอัปเดตข้อมูล
    const sanitizedContent = content ? isomorphic_dompurify_1.default.sanitize(content) : null;
    const updateData = {};
    if (title !== undefined)
        updateData.title = title;
    if (description !== undefined)
        updateData.description = description;
    if (content !== undefined)
        updateData.content = sanitizedContent;
    if (isShow !== undefined)
        updateData.isShow = isShow === 'true' || isShow === true;
    if (views !== undefined)
        updateData.views = parseInt(views);
    if (type !== undefined)
        updateData.type = type;
    if (date !== undefined)
        updateData.date = new Date(date);
    if (req.file) {
        updateData.image_src = `/uploads/${req.file.filename}`;
    }
    const updatedNews = await prisma_1.default.news.update({
        where: { id },
        data: updateData,
    });
    const adminUser = await prisma_1.default.user.findUnique({
        where: { uuid: req.user?.uuid },
    });
    await (0, auditLogger_1.logAudit)(req, 'UPDATE_NEWS_SUCCESS', `Admin updated news/event: (ID: ${id}, Title: "${updatedNews.title}", Image updated: ${req.file ? 'Yes' : 'No'})`, adminUser?.id);
    res.status(200).json({
        success: true,
        message: 'แก้ไขข้อมูลเสร็จสิ้น',
        data: updatedNews,
    });
});
//# sourceMappingURL=newsController.js.map