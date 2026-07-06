"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contactController_1 = require("../controllers/contactController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const router = (0, express_1.Router)();
/**
 * @ROUTE   POST /api/contact
 * @DESC    บันทึกข้อความการติดต่อจากประชาชนหน้าเว็บไซต์ (Public)
 */
router.post('/', contactController_1.createContact);
/**
 * @ROUTE   GET /api/contact
 * @DESC    ดึงรายการข้อความติดต่อทั้งหมด (สิทธิ์ Admin ในแดชบอร์ด)
 */
router.get('/', auth_1.default, contactController_1.getContactRequests);
/**
 * @ROUTE   PUT /api/contact/update
 * @DESC    อัปเดตสถานะข้อมูล (สถานะตอบกลับ) โดยผู้ใช้งานที่ลงทะเบียนผ่านสิทธิ์ตัวตน (Admin)
 */
router.put('/update', auth_1.default, contactController_1.updateContactStatus);
exports.default = router;
//# sourceMappingURL=contactRoute.js.map