import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MAX_IMAGE_SIDE = 2000
const WEBP_QUALITY = 82

const replaceExtension = (filePath: string, extension: string): string =>
  filePath.replace(/\.[^./\\]+$/, extension)

/**
 * แปลงไฟล์ที่ multer เขียนลงดิสก์ให้เป็น WebP
 * - ข้ามไฟล์ที่ไม่ใช่รูปภาพ (เช่น mp4)
 * - ถ้าเป็น WebP อยู่แล้วและขนาดไม่เกินเพดาน จะไม่แปลงซ้ำ (กันคุณภาพลดทับซ้อน)
 * - ตัด EXIF/GPS ทิ้ง (sharp ไม่คัดลอก metadata ให้) + หมุนตาม EXIF orientation
 * - จำกัดด้านยาวไม่เกิน MAX_IMAGE_SIDE โดยไม่ขยายรูปเล็ก
 * - สำเร็จแล้วลบไฟล์ต้นฉบับ และอัปเดต file.filename / file.path / file.mimetype
 * - ถ้าแปลงไม่สำเร็จ จะใช้ไฟล์ต้นฉบับต่อ (ไม่ทำให้การอัปโหลดล้ม)
 */
export const convertUploadToWebp = async (
  file: Express.Multer.File,
): Promise<void> => {
  if (!file.mimetype.startsWith('image/')) return

  const sourcePath = path.join(process.cwd(), file.path)

  try {
    const metadata = await sharp(sourcePath, { failOn: 'none' }).metadata()
    const needsResize =
      (metadata.width ?? 0) > MAX_IMAGE_SIDE ||
      (metadata.height ?? 0) > MAX_IMAGE_SIDE

    if (file.mimetype === 'image/webp' && !needsResize) return

    const outputRelativePath = replaceExtension(file.path, '.webp')
    const outputPath = path.join(process.cwd(), outputRelativePath)

    await sharp(sourcePath, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath)

    if (outputPath !== sourcePath) {
      await fs.unlink(sourcePath).catch(() => {})
    }

    file.filename = path.basename(outputRelativePath)
    file.path = outputRelativePath
    file.mimetype = 'image/webp'
  } catch (error) {
    console.error(
      '[image] แปลงเป็น WebP ไม่สำเร็จ ใช้ไฟล์ต้นฉบับแทน:',
      error,
    )
  }
}

export const convertUploadsToWebp = async (
  files: Express.Multer.File[] | undefined,
): Promise<void> => {
  if (!files || files.length === 0) return
  for (const file of files) {
    await convertUploadToWebp(file)
  }
}
