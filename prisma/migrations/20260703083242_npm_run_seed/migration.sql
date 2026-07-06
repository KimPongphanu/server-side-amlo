-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "FailedLoginAttempt" DROP CONSTRAINT "FailedLoginAttempt_userId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "region" TEXT,
ADD COLUMN     "serverIp" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "link_url" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isShow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splash_popups" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "splash_popups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedLoginAttempt" ADD CONSTRAINT "FailedLoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
