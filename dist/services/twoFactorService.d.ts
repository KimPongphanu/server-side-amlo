export declare const generateTOTPSecret: (email: string) => {
    secret: string;
    otpauthUrl: string;
};
export declare const verifyTOTP: (token: string, secret: string) => boolean;
export declare const generateEmailOTP: (email: string) => Promise<void>;
export declare const verifyEmailOTP: (email: string, otp: string) => Promise<boolean>;
export declare const generateRecoveryKeys: (userId: number) => Promise<string[]>;
export declare const verifyRecoveryKey: (userId: number, recoveryKey: string, req: any) => Promise<boolean>;
export declare const enableTOTPForUser: (userId: number, secret: string) => Promise<void>;
export declare const disableTOTPForUser: (userId: number) => Promise<void>;
//# sourceMappingURL=twoFactorService.d.ts.map