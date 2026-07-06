"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientMetadata = void 0;
const getClientMetadata = (req) => {
    // ดักจับ IP จริงจาก Header หากระบบรันหลัง Nginx, Cloudflare, Vercel หรือ Render
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedList = Array.isArray(forwardedFor)
        ? forwardedFor
        : (forwardedFor?.split(',') || []).map((s) => s.trim());
    return {
        // Public IP: ตัวแรกใน x-forwarded-for (IP จริงของผู้ใช้)
        ipAddress: forwardedList[0] || req.ip || '0.0.0.0',
        // Private IP: req.ip (IP ที่ Express server เห็น, เช่น 172.x.x.x ใน Docker)
        serverIp: req.ip || '0.0.0.0',
        // User Agent
        userAgent: req.headers['user-agent'] || 'Unknown Device',
    };
};
exports.getClientMetadata = getClientMetadata;
//# sourceMappingURL=ipSelector.js.map