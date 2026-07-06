/**
 * @ROUTE   POST /api/auth/users/:uuid/force-reset
 * @DESC    Supervisor forces a user to reset their password on next login
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
export declare const forceResetUserPassword: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/force-reset/send-otp
 * @DESC    Send OTP to the current user's email (called on page mount after forced reset)
 * @ACCESS  Authenticated user with forcePasswordReset flag
 */
export declare const sendForceResetOTP: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/force-reset/resend-otp
 * @DESC    Resend new OTP (invalidates old one)
 * @ACCESS  Authenticated user with forcePasswordReset flag
 */
export declare const resendForceResetOTP: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/auth/force-reset/verify
 * @DESC    Verify OTP and set new password. Also clears forcePasswordReset flag.
 * @ACCESS  Authenticated user with forcePasswordReset flag
 */
export declare const verifyForceResetOTP: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=forceResetController.d.ts.map