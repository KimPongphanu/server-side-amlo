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
// routes/supervisorRequestRoute.ts
const express_1 = require("express");
const supervisorRequestController_1 = require("../controllers/supervisorRequestController");
const auth_1 = __importStar(require("../middlewares/auth"));
const router = (0, express_1.Router)();
router.post('/', auth_1.default, auth_1.requireSupervisor, supervisorRequestController_1.createRequest);
router.get('/pending', auth_1.default, auth_1.requireSupervisor, supervisorRequestController_1.getPendingRequests);
router.get('/sent', auth_1.default, auth_1.requireSupervisor, supervisorRequestController_1.getSentRequests);
router.post('/:id/approve', auth_1.default, auth_1.requireSupervisor, supervisorRequestController_1.approveRequest);
router.post('/:id/reject', auth_1.default, auth_1.requireSupervisor, supervisorRequestController_1.rejectRequest);
exports.default = router;
//# sourceMappingURL=supervisorRequestRoute.js.map