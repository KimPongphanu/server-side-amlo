import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export declare const createSession: (userId: number, token: string, ipAddress: string, userAgent: string, expiresInHours: number) => Promise<void>;
export declare const validateAndUpdateSession: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const checkSessionLimit: (userId: number, role: string) => Promise<{
    allowed: boolean;
    currentSessions: number;
    maxSessions: number;
}>;
export declare const revokeAllUserSessions: (userId: number) => Promise<void>;
export declare const revokeOtherSessions: (userId: number, currentSessionId: string) => Promise<void>;
export declare const cleanupExpiredSessions: () => Promise<void>;
//# sourceMappingURL=session.d.ts.map