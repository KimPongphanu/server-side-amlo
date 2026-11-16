-- AlterTable: track when a temporary password was issued (TTL for bootstrap passwords)
ALTER TABLE "User" ADD COLUMN "tempPasswordIssuedAt" TIMESTAMP(3);

-- Backfill: accounts already awaiting a forced reset are treated as issued "now"
-- so nobody is instantly expired by this migration.
UPDATE "User"
SET "tempPasswordIssuedAt" = CURRENT_TIMESTAMP
WHERE "forcePasswordReset" = true;

-- DropTable: email OTP delivery is replaced entirely by TOTP (authenticator)
DROP TABLE IF EXISTS "email_otps";

-- AlterEnum: EMAIL_OTP is no longer a supported 2FA method.
-- PostgreSQL cannot DROP an enum value, so the type is rebuilt while preserving data.
-- Accounts that were on EMAIL_OTP had no authenticator secret, so they are reset
-- to NONE and must enroll an authenticator on next login.
UPDATE "User"
SET "twoFactorEnabled" = false,
    "twoFactorSecret" = NULL
WHERE "twoFactorMethod" = 'EMAIL_OTP';

UPDATE "User" SET "twoFactorMethod" = 'NONE' WHERE "twoFactorMethod" = 'EMAIL_OTP';

ALTER TYPE "TwoFactorMethod" RENAME TO "TwoFactorMethod_old";
CREATE TYPE "TwoFactorMethod" AS ENUM ('NONE', 'AUTHENTICATOR');
ALTER TABLE "User" ALTER COLUMN "twoFactorMethod" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "twoFactorMethod" TYPE "TwoFactorMethod"
  USING ("twoFactorMethod"::text::"TwoFactorMethod");
ALTER TABLE "User" ALTER COLUMN "twoFactorMethod" SET DEFAULT 'NONE';
DROP TYPE "TwoFactorMethod_old";
