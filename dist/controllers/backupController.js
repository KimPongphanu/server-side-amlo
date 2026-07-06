"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreBackup = exports.deleteBackup = exports.downloadBackup = exports.createBackup = exports.listBackupFiles = void 0;
// controllers/backupController.ts
const child_process_1 = require("child_process");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auditLogger_1 = require("../utils/auditLogger");
const BACKUP_DIR = path_1.default.join(__dirname, '..', 'backups');
// Ensure backup directory exists
if (!fs_1.default.existsSync(BACKUP_DIR)) {
    fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
}
// Auto-detect PostgreSQL bin path
const findPgBin = () => {
    // Check .env override first
    const envPath = process.env.PG_BIN_PATH;
    if (envPath)
        return envPath;
    // Common Windows PostgreSQL paths
    const versions = ['17', '16', '15', '14', '13', '12'];
    const commonPaths = [
        'C:\\Program Files\\PostgreSQL',
        'C:\\Program Files (x86)\\PostgreSQL',
    ];
    for (const base of commonPaths) {
        for (const ver of versions) {
            const fullPath = path_1.default.join(base, ver, 'bin');
            if (fs_1.default.existsSync(path_1.default.join(fullPath, 'pg_dump.exe'))) {
                console.log(`[Backup] Found PostgreSQL bin at: ${fullPath}`);
                return fullPath;
            }
        }
    }
    // Fallback to PATH
    return '';
};
const PG_BIN = findPgBin();
const cmd = (tool) => PG_BIN ? `"${path_1.default.join(PG_BIN, `${tool}.exe`)}"` : tool;
/**
 * Parse DATABASE_URL to pg_dump compatible connection string
 */
const parseDbUrl = () => {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error('DATABASE_URL is not defined');
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parsed.port || '5432',
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        dbname: parsed.pathname.slice(1),
    };
};
/**
 * Run pg_dump to create backup
 */
const runPgDump = (outputFile) => {
    return new Promise((resolve, reject) => {
        const db = parseDbUrl();
        const dumpCmd = `${cmd('pg_dump')} --host=${db.host} --port=${db.port} --username=${db.user} --dbname=${db.dbname} --file="${outputFile}" --format=plain --no-owner`;
        (0, child_process_1.exec)(dumpCmd, { env: { PGPASSWORD: db.password }, timeout: 5 * 60 * 1000 }, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
};
/**
 * Run pg_restore to restore from backup
 */
const runPgRestore = (inputFile) => {
    return new Promise((resolve, reject) => {
        const db = parseDbUrl();
        // Drop existing connections and recreate database
        const dropCmd = `${cmd('psql')} --host=${db.host} --port=${db.port} --username=${db.user} --dbname=postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${db.dbname}' AND pid <> pg_backend_pid();"`;
        const restoreCmd = `${cmd('psql')} --host=${db.host} --port=${db.port} --username=${db.user} --dbname=${db.dbname} --file="${inputFile}"`;
        const env = { PGPASSWORD: db.password };
        // First terminate connections, then restore
        (0, child_process_1.exec)(dropCmd, { env, timeout: 30 * 1000 }, (dropErr) => {
            if (dropErr) {
                // If drop fails, try restore anyway
                console.warn('[Backup] Could not terminate connections, trying restore anyway:', dropErr.message);
            }
            (0, child_process_1.exec)(restoreCmd, { env, timeout: 10 * 60 * 1000 }, (restoreErr) => {
                if (restoreErr)
                    reject(restoreErr);
                else
                    resolve();
            });
        });
    });
};
/**
 * List all backup files sorted by newest first
 */
const listBackups = () => {
    if (!fs_1.default.existsSync(BACKUP_DIR))
        return [];
    const files = fs_1.default
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => {
        const stat = fs_1.default.statSync(path_1.default.join(BACKUP_DIR, f));
        return {
            filename: f,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
        };
    })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return files;
};
/**
 * Cleanup old backups (keep last 7 days, max 14 files)
 */
const cleanupOldBackups = () => {
    const files = listBackups();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Delete files older than 7 days, keep max 14
    const toDelete = files
        .filter((f) => {
        return new Date(f.createdAt).getTime() < sevenDaysAgo;
    })
        .slice(14);
    for (const f of toDelete) {
        try {
            fs_1.default.unlinkSync(path_1.default.join(BACKUP_DIR, f.filename));
            console.log(`[Backup] Deleted old backup: ${f.filename}`);
        }
        catch {
            /* silent */
        }
    }
};
/**
 * @ROUTE   GET /api/backups
 * @DESC    List all backup files
 * @ACCESS  Supervisor only
 */
exports.listBackupFiles = (0, express_async_handler_1.default)(async (req, res) => {
    const files = listBackups();
    res.json({ success: true, data: files });
});
/**
 * @ROUTE   POST /api/backups
 * @DESC    Create a new database backup
 * @ACCESS  Supervisor only
 */
exports.createBackup = (0, express_async_handler_1.default)(async (req, res) => {
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${date}.sql`;
    const outputFile = path_1.default.join(BACKUP_DIR, filename);
    await runPgDump(outputFile);
    cleanupOldBackups();
    await (0, auditLogger_1.logAudit)(req, 'BACKUP_CREATED', `Backup created: ${filename}`, (await prisma_1.default.user.findUnique({ where: { uuid: req.user?.uuid } }))?.id);
    const stat = fs_1.default.statSync(outputFile);
    res.status(201).json({
        success: true,
        message: 'สร้าง Backup สำเร็จ',
        data: { filename, size: stat.size, createdAt: stat.mtime.toISOString() },
    });
});
/**
 * @ROUTE   GET /api/backups/:filename
 * @DESC    Download a backup file
 * @ACCESS  Supervisor only
 */
exports.downloadBackup = (0, express_async_handler_1.default)(async (req, res) => {
    const filename = req.params.filename;
    // Security: prevent directory traversal
    if (filename.includes('..') ||
        filename.includes('/') ||
        !filename.endsWith('.sql')) {
        res.status(400).json({ message: 'Invalid filename' });
        return;
    }
    const filePath = path_1.default.join(BACKUP_DIR, filename);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ message: 'ไม่พบไฟล์ Backup' });
        return;
    }
    res.download(filePath);
});
/**
 * @ROUTE   DELETE /api/backups/:filename
 * @DESC    Delete a backup file
 * @ACCESS  Supervisor only
 */
exports.deleteBackup = (0, express_async_handler_1.default)(async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') ||
        filename.includes('/') ||
        !filename.endsWith('.sql')) {
        res.status(400).json({ message: 'Invalid filename' });
        return;
    }
    const filePath = path_1.default.join(BACKUP_DIR, filename);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ message: 'ไม่พบไฟล์ Backup' });
        return;
    }
    fs_1.default.unlinkSync(filePath);
    await (0, auditLogger_1.logAudit)(req, 'BACKUP_DELETED', `Backup deleted: ${filename}`, (await prisma_1.default.user.findUnique({ where: { uuid: req.user?.uuid } }))?.id);
    res.json({ success: true, message: 'ลบไฟล์ Backup สำเร็จ' });
});
/**
 * @ROUTE   POST /api/backups/:filename/restore
 * @DESC    Restore database from backup file
 * @ACCESS  Supervisor only (requires double confirmation)
 */
exports.restoreBackup = (0, express_async_handler_1.default)(async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') ||
        filename.includes('/') ||
        !filename.endsWith('.sql')) {
        res.status(400).json({ message: 'Invalid filename' });
        return;
    }
    const filePath = path_1.default.join(BACKUP_DIR, filename);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ message: 'ไม่พบไฟล์ Backup' });
        return;
    }
    await runPgRestore(filePath);
    await (0, auditLogger_1.logAudit)(req, 'BACKUP_RESTORED', `Database restored from: ${filename}`, (await prisma_1.default.user.findUnique({ where: { uuid: req.user?.uuid } }))?.id);
    res.json({
        success: true,
        message: 'กู้คืนข้อมูลจาก Backup สำเร็จ',
    });
});
//# sourceMappingURL=backupController.js.map