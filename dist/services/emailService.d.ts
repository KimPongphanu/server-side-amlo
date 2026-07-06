interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}
export declare const sendEmail: (options: EmailOptions) => Promise<void>;
export declare const sendLoginAlertEmail: (email: string, name: string, ipAddress: string, userAgent: string, timestamp: Date) => Promise<void>;
export declare const sendRecoveryKeyUsedAlert: (email: string, name: string, ipAddress: string, userAgent: string) => Promise<void>;
export declare const sendUserActionAlert: (adminEmail: string, adminName: string, targetEmail: string, targetName: string, action: string, reason: string, performedBy: string, ipAddress: string) => Promise<void>;
export declare const sendOTPEmail: (email: string, otp: string, expiresInMinutes: number) => Promise<void>;
export {};
//# sourceMappingURL=emailService.d.ts.map