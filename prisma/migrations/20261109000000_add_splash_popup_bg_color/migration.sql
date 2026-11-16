-- AlterTable
-- เพิ่มคอลัมน์ bg_color ที่มีใน schema.prisma แต่ขาดหายจาก migration เดิม
-- ใช้ IF NOT EXISTS เพื่อรองรับฐานข้อมูลที่อาจเคยรัน `prisma db push` มาก่อน
ALTER TABLE "splash_popups" ADD COLUMN IF NOT EXISTS "bg_color" TEXT NOT NULL DEFAULT '#ffffff';
