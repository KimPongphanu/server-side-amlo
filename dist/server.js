"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron")); // 🌟 นำเข้า node-cron เข้ามาจัดการรอบเวลาทำงานเบื้องหลัง
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middlewares/errorHandler");
const setCharset_1 = require("./middlewares/setCharset");
const prisma_1 = __importDefault(require("./lib/prisma")); // 🌟 นำเข้า prisma client เพื่อสั่งคำสั่งลบข้อมูลโดยตรง
const rateLimiter_1 = require("./middlewares/rateLimiter");
const adminRoute_1 = __importDefault(require("./routes/adminRoute"));
const auditRoute_1 = __importDefault(require("./routes/auditRoute"));
const authRoute_1 = __importDefault(require("./routes/authRoute"));
const backupRoute_1 = __importDefault(require("./routes/backupRoute"));
const bannerRoute_1 = __importDefault(require("./routes/bannerRoute"));
const commentRoute_1 = __importDefault(require("./routes/commentRoute"));
const contactRoute_1 = __importDefault(require("./routes/contactRoute"));
const departmentRoute_1 = __importDefault(require("./routes/departmentRoute"));
const fileRoute_1 = __importDefault(require("./routes/fileRoute"));
const footerSettingRoute_1 = __importDefault(require("./routes/footerSettingRoute"));
const newsRoute_1 = __importDefault(require("./routes/newsRoute"));
const sliderRoute_1 = __importDefault(require("./routes/sliderRoute"));
const splashPopupRoute_1 = __importDefault(require("./routes/splashPopupRoute"));
const supervisorRequestRoute_1 = __importDefault(require("./routes/supervisorRequestRoute"));
const twoFactorRoute_1 = __importDefault(require("./routes/twoFactorRoute"));
const uploadRoute_1 = __importDefault(require("./routes/uploadRoute"));
const app = (0, express_1.default)();
const port = 8080;
// ── 1. ประกาศตั้งค่าพื้นฐานของระบบและ CORS ก่อนเริ่มแมป Route ──
app.set('trust proxy', 1); // trust first proxy (Nginx, Cloudflare, etc.)
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use(setCharset_1.setCharset);
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://10.89.163.40:5173',
    'http://localhost',
    'http://127.0.0.1',
]; // ตัวอย่าง
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://10.89.163.40:5173',
            'http://localhost',
            'http://127.0.0.1',
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
}));
// ── 2. ประกาศใช้ Static Files และ Rate Limiter ส่วนกลาง ──
const fs_1 = __importDefault(require("fs"));
const UPLOADS_DIR = fs_1.default.existsSync('/app/uploads')
    ? '/app/uploads'
    : path_1.default.join(__dirname, 'uploads');
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
app.use('/api', rateLimiter_1.apiLimiter);
// ── 3. กลุ่ม Route บริการต่างๆ ──
app.use('/api/admin', adminRoute_1.default);
app.use('/api/auth', authRoute_1.default);
app.use('/api/upload', uploadRoute_1.default);
app.use('/api/news', newsRoute_1.default);
app.use('/api/departments', departmentRoute_1.default);
app.use('/api/files', fileRoute_1.default);
app.use('/api/contact', contactRoute_1.default);
app.use('/api/comments', commentRoute_1.default);
app.use('/api/audit', auditRoute_1.default);
app.use('/api/banners', bannerRoute_1.default);
app.use('/api/settings', footerSettingRoute_1.default);
app.use('/api/slider', sliderRoute_1.default);
app.use('/api/splash-popups', splashPopupRoute_1.default);
app.use('/api/2fa', twoFactorRoute_1.default);
app.use('/api/supervisor-request', supervisorRequestRoute_1.default);
app.use('/api/backups', backupRoute_1.default);
app.get('/', (req, res) => {
    res.send('Server is running with TypeScript!');
});
app.use(errorHandler_1.globalErrorHandler);
// ── 4. Auto Backup — 03:00 daily ──
const child_process_1 = require("child_process");
node_cron_1.default.schedule('0 3 * * *', () => {
    const fs = require('fs');
    const p = require('path');
    const pgDump = 'pg_dump';
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${date}.sql`;
    const backupDir = '/app/backups';
    if (!fs.existsSync(backupDir))
        fs.mkdirSync(backupDir, { recursive: true });
    const outputFile = p.join(backupDir, filename);
    const url = new URL(process.env.DATABASE_URL);
    const cmd = `${pgDump} --host=${url.hostname} --port=${url.port || '5432'} --username=${decodeURIComponent(url.username)} --dbname=${url.pathname.slice(1)} --file="${outputFile}" --format=plain --no-owner`;
    (0, child_process_1.exec)(cmd, {
        env: { PGPASSWORD: decodeURIComponent(url.password) },
        timeout: 5 * 60 * 1000,
    }, (err) => {
        if (err)
            return console.error('[Auto Backup] Failed:', err.message);
        console.log(`[Auto Backup] Created: ${filename} (${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)} MB)`);
    });
});
// ── 5. กลไกลบ Audit Log อัตโนมัติ (Data Retention Policy) ──
node_cron_1.default.schedule('0 0 * * *', async () => {
    try {
        const cutOffDate = new Date();
        cutOffDate.setDate(cutOffDate.getDate() - 90); // คำนวณช่วงเวลาถอยหลังย้อนหลัง 90 วัน
        const result = await prisma_1.default.auditLog.deleteMany({
            where: {
                createdAt: { lt: cutOffDate }, // สั่งลบแถวบันทึกที่มีอายุเก่ากว่าช่วงวันที่กำหนด
            },
        });
        console.log(`[Cron Job] Expired audit logs cleaned successfully. Deleted ${result.count} rows.`);
    }
    catch (error) {
        console.error('[Cron Job Error] Failed to clean expired audit logs:', error);
    }
});
// ── 6. ลบ JWT Blacklist ที่หมดอายุแล้ว (ทุก 1 ชั่วโมง) ──
node_cron_1.default.schedule('0 * * * *', async () => {
    try {
        // Token อายุ 1 วัน ลบ token ที่เก่ากว่า 24 ชั่วโมง
        const cutOff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await prisma_1.default.jwtBlacklist.deleteMany({
            where: { createdAt: { lt: cutOff } },
        });
        if (result.count > 0) {
            console.log(`[Cron Job] Cleaned ${result.count} expired JWT blacklist entries.`);
        }
    }
    catch (error) {
        console.error('[Cron Job Error] Failed to clean JWT blacklist:', error);
    }
});
const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server is running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map