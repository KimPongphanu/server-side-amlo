"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const commentController_1 = require("../controllers/commentController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @ROUTE   POST /api/comments
 * @DESC    บันทึกความคิดเห็นจากประชาชนหน้าเว็บไซต์ (Public)
 */
router.post('/', rateLimiter_1.commentRateLimiter, commentController_1.createComment);
/**
 * @ROUTE   GET /api/comments
 * @DESC    ดึงรายการความคิดเห็นทั้งหมด (แสดงตามเงื่อนไขของฝั่งผู้ใช้หรือ Admin)
 */
router.get('/', commentController_1.getComments);
/**
 * @ROUTE   PUT /api/comments/update
 * @DESC    อัปเดตสถานะการแสดงผล (isShow) ของความคิดเห็น (สิทธิ์ Admin ในแดชบอร์ด)
 */
router.put('/update', auth_1.default, commentController_1.updateComment);
exports.default = router;
//# sourceMappingURL=commentRoute.js.map