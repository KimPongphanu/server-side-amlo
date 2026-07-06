"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const uploadDir = 'uploads/';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir);
}
// Map allowed MIME types to their secure file extensions
const mimeToExtension = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
};
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // Force the file extension based on the validated MIME type.
        // This prevents File Extension Spoofing (e.g., uploading shell.php as image/jpeg).
        const safeExtension = mimeToExtension[file.mimetype] || '.bin';
        cb(null, `${file.fieldname}-${uniqueSuffix}${safeExtension}`);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    // First line of defense: filter by MIME type
    fileFilter: (req, file, cb) => {
        // We can use the keys from our mimeToExtension object as the allowed list
        const allowedMimeTypes = Object.keys(mimeToExtension);
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('This file type is not allowed in the system'), false);
        }
        cb(null, true);
    },
});
exports.default = upload;
//# sourceMappingURL=upload.js.map