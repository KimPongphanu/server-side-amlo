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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/auditRoute.ts
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = __importStar(require("../middlewares/auth"));
const router = express_1.default.Router();
router.get('/', auth_1.default, (0, auth_1.restrictTo)('SUPERVISOR'), (0, express_async_handler_1.default)(async (req, res) => {
    let userId = undefined;
    if (req.query.userId) {
        const parsed = Number(req.query.userId);
        if (!isNaN(parsed)) {
            userId = parsed;
        }
    }
    // รองรับการค้นหาผ่าน UUID (จาก Frontend UserAuditLog)
    if (!userId && req.query.uuid) {
        const user = await prisma_1.default.user.findUnique({
            where: { uuid: req.query.uuid },
            select: { id: true },
        });
        if (user)
            userId = user.id;
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 'asc' : 'desc';
    const skip = (page - 1) * limit;
    const validSortFields = ['createdAt', 'action', 'ipAddress'];
    const orderBy = validSortFields.includes(sortField)
        ? { [sortField]: sortOrder }
        : { createdAt: 'desc' };
    const action = req.query.action;
    const q = req.query.q;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    const region = req.query.region;
    const serverIp = req.query.serverIp;
    const where = {};
    if (userId)
        where.userId = userId;
    if (action && action !== 'all')
        where.action = action;
    if (q && q.trim()) {
        const searchTerm = q.trim();
        where.OR = [
            { action: { contains: searchTerm, mode: 'insensitive' } },
            { details: { contains: searchTerm, mode: 'insensitive' } },
            { ipAddress: { contains: searchTerm } },
            { serverIp: { contains: searchTerm } },
            { region: { contains: searchTerm, mode: 'insensitive' } },
            { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
        ];
    }
    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom)
            where.createdAt.gte = new Date(dateFrom);
        if (dateTo)
            where.createdAt.lte = new Date(dateTo);
    }
    if (region && region.trim()) {
        where.region = { contains: region.trim(), mode: 'insensitive' };
    }
    if (serverIp && serverIp.trim()) {
        where.serverIp = { contains: serverIp.trim() };
    }
    const [logs, total] = await Promise.all([
        prisma_1.default.auditLog.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        email: true,
                        firstname: true,
                        lastname: true,
                    },
                },
            },
            omit: {
            // ไม่ต้องเลือก field ที่ไม่จำเป็น (ถ้ามี)
            },
        }),
        prisma_1.default.auditLog.count({ where }),
    ]);
    res.status(200).json({
        success: true,
        data: logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}));
exports.default = router;
//# sourceMappingURL=auditRoute.js.map