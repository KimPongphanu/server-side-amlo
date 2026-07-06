"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/uploadRoute.ts
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler")); // 🌟 นำเข้า asyncHandler
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload")); // นำเข้า multer middleware แบบ ES Modules
const router = express_1.default.Router();
/**
 * @ROUTE   POST /api/upload/single
 * @DESC    1. อัปโหลดไฟล์เดียว (Single File) - คีย์ต้องชื่อว่า 'singleFile'
 */
router.post('/single', rateLimiter_1.uploadLimiter, upload_1.default.single('singleFile'), (0, express_async_handler_1.default)(async (req, res) => {
    if (!req.file) {
        res.status(400).json({ message: 'กรุณาอัปโหลดไฟล์' });
        return;
    }
    res.status(200).json({
        message: 'อัปโหลดไฟล์เดียวสำเร็จ!',
        fileInfo: req.file,
    });
}));
/**
 * @ROUTE   POST /api/upload/multiple
 * @DESC    2. อัปโหลดหลายไฟล์ (Multiple Files) - คีย์ต้องชื่อว่า 'multipleFiles' สูงสุด 5 ไฟล์
 */
router.post('/multiple', upload_1.default.array('multipleFiles', 5), (0, express_async_handler_1.default)(async (req, res) => {
    // กำหนด Type ให้ชัดเจนว่าเป็น Array ของ Multer File
    const files = req.files;
    if (!files || files.length === 0) {
        res.status(400).json({ message: 'กรุณาอัปโหลดอย่างน้อย 1 ไฟล์' });
        return;
    }
    res.status(200).json({
        message: 'อัปโหลดหลายไฟล์สำเร็จ!',
        filesInfo: files,
    });
}));
exports.default = router;
//# sourceMappingURL=uploadRoute.js.map