"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sliderController_1 = require("../controllers/sliderController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = express_1.default.Router();
// GET /api/slider - สาธารณะ
router.get('/', sliderController_1.getAllSlides);
// POST /api/slider - ต้องล็อกอิน, จำกัด rate, อัปโหลดไฟล์ก่อน
router.post('/', auth_1.default, rateLimiter_1.uploadLimiter, upload_1.default.single('image'), sliderController_1.createSlide);
// PUT /api/slider/reorder - ต้องล็อกอิน
router.put('/reorder', auth_1.default, sliderController_1.reorderSlides);
// DELETE /api/slider/:id - ต้องล็อกอิน
router.delete('/:id', auth_1.default, sliderController_1.deleteSlide);
exports.default = router;
//# sourceMappingURL=sliderRoute.js.map