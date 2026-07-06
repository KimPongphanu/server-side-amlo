"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const globalErrorHandler = (err, req, res, next) => {
    console.error('Global Error Handler:', err); // Log error for debugging
    // Send a clean response to the client
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};
exports.globalErrorHandler = globalErrorHandler;
//# sourceMappingURL=errorHandler.js.map