/**
 * POST /api/supervisor-request
 * Create a new supervisor action request (Requires: password verification)
 */
export declare const createRequest: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * GET /api/supervisor-request/pending
 * Get all pending requests targeting the current user
 */
export declare const getPendingRequests: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * GET /api/supervisor-request/sent
 * Get requests created by the current user
 */
export declare const getSentRequests: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * POST /api/supervisor-request/:id/approve
 * Approve a request (Requires: OTP from Google Authenticator)
 */
export declare const approveRequest: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * POST /api/supervisor-request/:id/reject
 * Reject a request
 */
export declare const rejectRequest: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=supervisorRequestController.d.ts.map