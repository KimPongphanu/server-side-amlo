/**
 * @ROUTE   GET /api/backups
 * @DESC    List all backup files
 * @ACCESS  Supervisor only
 */
export declare const listBackupFiles: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/backups
 * @DESC    Create a new database backup
 * @ACCESS  Supervisor only
 */
export declare const createBackup: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   GET /api/backups/:filename
 * @DESC    Download a backup file
 * @ACCESS  Supervisor only
 */
export declare const downloadBackup: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   DELETE /api/backups/:filename
 * @DESC    Delete a backup file
 * @ACCESS  Supervisor only
 */
export declare const deleteBackup: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * @ROUTE   POST /api/backups/:filename/restore
 * @DESC    Restore database from backup file
 * @ACCESS  Supervisor only (requires double confirmation)
 */
export declare const restoreBackup: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=backupController.d.ts.map