/**
 * @ROUTE   POST /api/auth/emergency-action
 * @DESC    Supervisor uses another Supervisor's recovery key to BAN/DELETE/FORCE_RESET
 *          Used when the target supervisor account is compromised
 * @ACCESS  Supervisor only (auth + requireSupervisor)
 */
export declare const emergencyAction: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=emergencyController.d.ts.map