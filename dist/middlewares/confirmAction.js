"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelConfirmation = exports.step3ExecuteWithDelay = exports.step2ConfirmWithReason = exports.step1RequestConfirmation = void 0;
// backend/middlewares/confirmAction.ts
const crypto_1 = __importDefault(require("crypto"));
const confirmationStore = new Map();
const STORE_EXPIRY_MS = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of confirmationStore.entries()) {
        if (value.expiresAt < now) {
            confirmationStore.delete(key);
        }
    }
}, 60 * 1000);
const generateToken = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
const step1RequestConfirmation = async (req, res) => {
    const confirmationToken = generateToken();
    res.json({
        success: true,
        step: 1,
        message: 'Confirmation requested. Check your email/app.',
        confirmationToken,
    });
};
exports.step1RequestConfirmation = step1RequestConfirmation;
const step2ConfirmWithReason = async (req, res) => {
    const { token, reason } = req.body;
    res.json({
        success: true,
        step: 2,
        message: 'Confirmed. Delaying execution by 5 minutes.',
    });
};
exports.step2ConfirmWithReason = step2ConfirmWithReason;
const step3ExecuteWithDelay = async (req, res) => {
    res.json({
        success: true,
        step: 3,
        message: 'Action executed successfully.',
    });
};
exports.step3ExecuteWithDelay = step3ExecuteWithDelay;
const cancelConfirmation = (req, res, action) => {
    const sessionId = req.session?.id || req.cookies.token?.substring(0, 16);
    const storeKey = `confirm_${sessionId}_${action}`;
    confirmationStore.delete(storeKey);
    res.status(200).json({
        success: true,
        message: 'Action cancelled',
    });
};
exports.cancelConfirmation = cancelConfirmation;
//# sourceMappingURL=confirmAction.js.map