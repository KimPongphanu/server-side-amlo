"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMagicBytes = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const validateMagicBytes = async (filePath, mimetype) => {
    try {
        // Read the first 12 bytes
        const fileHandle = await promises_1.default.open(filePath, 'r');
        const buffer = Buffer.alloc(12);
        await fileHandle.read(buffer, 0, 12, 0);
        await fileHandle.close();
        const hex = buffer.toString('hex').toLowerCase();
        if (mimetype === 'image/jpeg') {
            return hex.startsWith('ffd8ff');
        }
        if (mimetype === 'image/png') {
            return hex.startsWith('89504e47');
        }
        if (mimetype === 'image/webp') {
            // 'RIFF' is 52494646, then 4 bytes length, then 'WEBP' which is 57454250
            const isRiff = hex.startsWith('52494646');
            const isWebp = buffer.toString('utf8', 8, 12) === 'WEBP';
            return isRiff && isWebp;
        }
        if (mimetype === 'video/mp4') {
            // MP4 files have 'ftyp' at bytes 4-7
            return buffer.toString('utf8', 4, 8) === 'ftyp';
        }
        return false;
    }
    catch (error) {
        console.error('Magic bytes validation error:', error);
        return false;
    }
};
exports.validateMagicBytes = validateMagicBytes;
//# sourceMappingURL=fileValidator.js.map