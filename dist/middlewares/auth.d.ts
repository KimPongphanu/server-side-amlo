import { NextFunction, Request, Response } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        uuid: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
    };
    session?: {
        id: string;
        userId: number;
    };
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const restrictTo: (...allowedRoles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireSupervisor: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => void;
declare const authMiddlewareExport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export default authMiddlewareExport;
//# sourceMappingURL=auth.d.ts.map