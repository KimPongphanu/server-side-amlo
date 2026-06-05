/*
  Warnings:

  - You are about to drop the `CommentItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CommentItem";

-- CreateTable
CREATE TABLE "comment_items" (
    "id" TEXT NOT NULL,
    "star" INTEGER NOT NULL,
    "msg" TEXT NOT NULL,
    "isShow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_items_pkey" PRIMARY KEY ("id")
);
