"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const newsController_1 = require("../controllers/newsController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = express_1.default.Router();
/**
 * @ROUTE   POST /api/news
 * @DESC    สร้างข่าวสารหรือกิจกรรมใหม่ (Admin Only)
 */
router.post('/', auth_1.default, rateLimiter_1.uploadLimiter, upload_1.default.single('image'), newsController_1.createNews);
/**
 * @ROUTE   GET /api/news
 * @DESC    ดึงรายการข่าวและกิจกรรมทั้งหมด
 */
router.get('/', newsController_1.getNews);
/**
 * @ROUTE   PUT /api/news/:id
 * @DESC    อัปเดตแก้ไขข้อมูลข่าวหรือ PR ตาม ID ข้อมูล (Admin Only)
 */
router.put('/:id', auth_1.default, upload_1.default.single('image'), newsController_1.updateNews);
exports.default = router;
//# sourceMappingURL=newsRoute.js.map