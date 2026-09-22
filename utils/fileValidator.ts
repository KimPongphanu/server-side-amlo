import fs from 'fs/promises'

const HEADER_BYTES = 65536
const MAX_IMAGE_SIDE = 10000
const MAX_IMAGE_PIXELS = 40000000

interface ImageSize {
  width: number
  height: number
}

const jpegSize = (buffer: Buffer): ImageSize | null => {
  let offset = 2

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2
      continue
    }

    const length = buffer.readUInt16BE(offset + 2)
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    offset += 2 + length
  }

  return null
}

const pngSize = (buffer: Buffer): ImageSize | null => {
  if (buffer.length < 24) return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const webpSize = (buffer: Buffer): ImageSize | null => {
  if (buffer.length < 30) return null

  const format = buffer.toString('ascii', 12, 16)

  if (format === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    }
  }

  if (format === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }

  if (format === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }

  return null
}

const readImageSize = (
  buffer: Buffer,
  mimetype: string,
): ImageSize | null => {
  if (mimetype === 'image/jpeg') return jpegSize(buffer)
  if (mimetype === 'image/png') return pngSize(buffer)
  if (mimetype === 'image/webp') return webpSize(buffer)
  return null
}

/**
 * ตรวจไฟล์อัปโหลด 2 ชั้น:
 *  1) magic bytes — เนื้อหาต้องตรงกับ MIME ที่อนุญาต (กันไฟล์อันตรายปลอมนามสกุล)
 *  2) ขนาดภาพ — กันไฟล์รูปขนาดมหาศาล (decompression bomb) ที่ทำเบราว์เซอร์ผู้ชมค้าง
 * ถ้าอ่านขนาดไม่ได้ (ไฟล์ประหลาด) จะข้ามการเช็คขนาดแล้วให้ magic bytes เป็นตัวตัดสิน
 */
export const validateMagicBytes = async (
  filePath: string,
  mimetype: string,
): Promise<boolean> => {
  try {
    const fileHandle = await fs.open(filePath, 'r')

    let buffer: Buffer
    try {
      const stats = await fileHandle.stat()
      buffer = Buffer.alloc(Math.min(HEADER_BYTES, Math.max(stats.size, 12)))
      await fileHandle.read(buffer, 0, buffer.length, 0)
    } finally {
      await fileHandle.close()
    }

    const isJpeg =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    const isWebp =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    const isMp4 = buffer.toString('ascii', 4, 8) === 'ftyp'

    let magicBytesMatch = false
    if (mimetype === 'image/jpeg') magicBytesMatch = isJpeg
    else if (mimetype === 'image/png') magicBytesMatch = isPng
    else if (mimetype === 'image/webp') magicBytesMatch = isWebp
    else if (mimetype === 'video/mp4') magicBytesMatch = isMp4

    if (!magicBytesMatch) return false

    const size = readImageSize(buffer, mimetype)
    if (!size) return true

    if (size.width <= 0 || size.height <= 0) return false
    if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) return false
    if (size.width * size.height > MAX_IMAGE_PIXELS) return false

    return true
  } catch (error) {
    console.error('Magic bytes validation error:', error)
    return false
  }
}
