export declare const registerUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const loginUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const logoutUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const getMe: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const getUsers: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const banUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const unbanUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const deleteUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/heartbeat
 * @DESC    อัปเดตเวลา recentOnline ของ User เพื่อบอกว่ายังออนไลน์อยู่ (ยิงทุก 5 นาทีจาก Frontend)
 * @ACCESS  Private (ต้องมี JWT Token ที่ถูกต้อง)
 */
export declare const heartbeat: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   PUT /api/auth/me
 * @DESC    Update current user's firstname and lastname
 * @ACCESS  Authenticated (ADMIN or SUPERVISOR)
 */
export declare const updateMyProfile: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/users/:uuid/otp-action
 * @DESC    Supervisor uses own OTP (2FA) to unban another Supervisor
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
export declare const supervisorOTPAction: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/users/:uuid/force-logout
 * @DESC    Supervisor uses own OTP to force logout another user by revoking all sessions
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
export declare const forceLogoutUser: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=authController.d.ts.map