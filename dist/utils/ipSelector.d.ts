import { Request } from 'express';
export interface ClientMetadata {
    ipAddress: string;
    serverIp: string;
    userAgent: string;
}
export declare const getClientMetadata: (req: Request) => ClientMetadata;
//# sourceMappingURL=ipSelector.d.ts.map