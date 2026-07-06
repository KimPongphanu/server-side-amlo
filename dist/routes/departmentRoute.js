"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const departmentController_1 = require("../controllers/departmentController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const rateLimiter_1 = require("../middlewares/rateLimiter");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = (0, express_1.Router)();
router.post('/', auth_1.default, rateLimiter_1.uploadLimiter, upload_1.default.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
]), departmentController_1.createDepartment);
router.get('/', departmentController_1.getDepartments);
router.delete('/:id', auth_1.default, departmentController_1.deleteDepartment);
router.put('/:id', auth_1.default, rateLimiter_1.uploadLimiter, upload_1.default.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
]), departmentController_1.updateDepartment);
exports.default = router;
//# sourceMappingURL=departmentRoute.js.map