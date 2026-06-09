-- CreateTable
CREATE TABLE "slider_images" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slider_images_pkey" PRIMARY KEY ("id")
);
