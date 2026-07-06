"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// routes/adminRoute.ts
const express_1 = require("express");
const adminUserController_1 = require("../controllers/adminUserController");
const auth_1 = __importStar(require("../middlewares/auth"));
const router = (0, express_1.Router)();
/**
 * @ROUTE   POST /api/admin/users
 * @DESC    Create a new admin (Supervisor only)
 */
router.post('/users', auth_1.default, auth_1.requireSupervisor, adminUserController_1.createAdmin);
/**
 * @ROUTE   GET /api/admin/users
 * @DESC    Get all admins (Supervisor only)
 */
router.get('/users', auth_1.default, auth_1.requireSupervisor, adminUserController_1.getAdmins);
/**
 * @ROUTE   GET /api/admin/users/:uuid
 * @DESC    Get admin by UUID (Supervisor only)
 */
router.get('/users/:uuid', auth_1.default, auth_1.requireSupervisor, adminUserController_1.getAdminById);
/**
 * @ROUTE   PUT /api/admin/users/:uuid
 * @DESC    Update admin info (Supervisor only)
 */
router.put('/users/:uuid', auth_1.default, auth_1.requireSupervisor, adminUserController_1.updateAdmin);
/**
 * @ROUTE   POST /api/admin/users/:uuid/ban
 * @DESC    Ban admin with 3-step confirmation (Supervisor only)
 */
router.post('/users/:uuid/ban', auth_1.default, auth_1.requireSupervisor, adminUserController_1.banAdmin);
/**
 * @ROUTE   POST /api/admin/users/:uuid/unban
 * @DESC    Unban admin with 3-step confirmation (Supervisor only)
 */
router.post('/users/:uuid/unban', auth_1.default, auth_1.requireSupervisor, adminUserController_1.unbanAdmin);
/**
 * @ROUTE   DELETE /api/admin/users/:uuid
 * @DESC    Delete admin with 3-step confirmation (Supervisor only)
 */
router.delete('/users/:uuid', auth_1.default, auth_1.requireSupervisor, adminUserController_1.deleteAdmin);
exports.default = router;
//# sourceMappingURL=adminRoute.js.map