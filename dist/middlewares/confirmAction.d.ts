import { Request, Response } from 'express';
import { AuthRequest } from './auth';
export declare const step1RequestConfirmation: (req: Request, res: Response) => Promise<void>;
export declare const step2ConfirmWithReason: (req: Request, res: Response) => Promise<void>;
export declare const step3ExecuteWithDelay: (req: Request, res: Response) => Promise<void>;
export declare const cancelConfirmation: (req: AuthRequest, res: Response, action: string) => void;
//# sourceMappingURL=confirmAction.d.ts.map