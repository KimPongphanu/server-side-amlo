"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/fileRoute.ts
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler")); // 🌟 นำเข้า asyncHandler
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("../middlewares/auth"));
const router = express_1.default.Router();
router.get('/private/:filename', auth_1.default, (0, express_async_handler_1.default)(async (req, res) => {
    // 🌟 ใช้ path.basename() เพื่อสกัดเอาแค่ชื่อไฟล์ ป้องกัน Path Traversal (เช่น ../../.env)
    const fileName = path_1.default.basename(req.params.filename);
    // เมื่อถูกคลีนแล้ว นำไปต่อกับ Path หลักของโฟลเดอร์ได้อย่างปลอดภัย
    const filePath = path_1.default.join(__dirname, '../private_uploads', fileName);
    // 🌟 ส่งไฟล์พร้อมดักจับ Error กรณีไม่พบไฟล์
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).json({ success: false, message: 'ไม่พบไฟล์ที่ต้องการ' });
        }
    });
}));
exports.default = router;
//# sourceMappingURL=fileRoute.js.map