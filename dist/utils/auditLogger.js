"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const ipSelector_1 = require("./ipSelector");
const GEO_CACHE = new Map();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // Cache GeoIP 24 ชม.
const GEO_API_URL = 'http://ip-api.com/json';
const lookupGeoRegion = async (ip) => {
    // ถ้าเป็น private/local IP ไม่ต้อง query Geo
    if (!ip ||
        ip === '0.0.0.0' ||
        ip === '127.0.0.1' ||
        ip === 'localhost' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.')) {
        return null;
    }
    // Check cache
    const cached = GEO_CACHE.get(ip);
    if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
        return cached.region;
    }
    try {
        const res = await fetch(`${GEO_API_URL}/${ip}?fields=country,regionName,city`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok)
            return null;
        const data = (await res.json());
        if (data.country) {
            const region = `${data.country}, ${data.regionName}, ${data.city}`;
            GEO_CACHE.set(ip, { region, cachedAt: Date.now() });
            return region;
        }
    }
    catch {
        // fail silently — ไม่ blocking
    }
    return null;
};
const logAudit = async (req, action, details, userId) => {
    const { ipAddress, serverIp, userAgent } = (0, ipSelector_1.getClientMetadata)(req);
    const region = await lookupGeoRegion(ipAddress);
    try {
        await prisma_1.default.auditLog.create({
            data: { userId, action, ipAddress, serverIp, region, userAgent, details },
        });
    }
    catch (err) {
        console.error(`Audit Log Failed [${action}]:`, err);
    }
};
exports.logAudit = logAudit;
//# sourceMappingURL=auditLogger.js.map