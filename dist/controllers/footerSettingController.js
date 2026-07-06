"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getAllSettings = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const AppError_1 = require("../utils/AppError");
// GET /api/settings — ดึง settings ทั้งหมด (สาธารณะ)
exports.getAllSettings = (0, express_async_handler_1.default)(async (req, res, next) => {
    const settings = await prisma_1.default.site_settings.findMany();
    const map = {};
    settings.forEach((s) => {
        map[s.key] = s.value;
    });
    res.status(200).json({ success: true, data: map });
});
// PUT /api/settings — อัปเดต settings (admin เท่านั้น)
exports.updateSettings = (0, express_async_handler_1.default)(async (req, res, next) => {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
        throw new AppError_1.AppError('ข้อมูล settings ต้องเป็น array', 400);
    }
    for (const item of settings) {
        if (typeof item.key !== 'string' || typeof item.value !== 'string') {
            throw new AppError_1.AppError('ข้อมูล key และ value ต้องเป็น string', 400);
        }
    }
    await prisma_1.default.$transaction(settings.map((item) => prisma_1.default.site_settings.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
    })));
    // Return updated map
    const all = await prisma_1.default.site_settings.findMany();
    const map = {};
    all.forEach((s) => {
        map[s.key] = s.value;
    });
    res
        .status(200)
        .json({ success: true, data: map, message: 'บันทึกการตั้งค่าสำเร็จ' });
});
//# sourceMappingURL=footerSettingController.js.map