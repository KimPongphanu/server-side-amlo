//เวลาต้องการหยอดข้อมูลเข้า Database ให้เปิด Terminal แล้วพิมพ์คำสั่งนี้
//npx prisma db seed
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seeding...')

  // 1. ตรวจสอบก่อนว่ามี Admin ในระบบหรือยัง เพื่อไม่ให้ข้อมูลซ้ำซ้อน
  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (!adminExists) {
    // 2. Hash รหัสผ่านสำหรับ Admin คนแรก
    const hashedPassword = await bcrypt.hash('SuperSecurePassword123!', 10)

    // 3. ยิงข้อมูลเข้าฐานข้อมูล
    const rootAdmin = await prisma.user.create({
      data: {
        email: 'rootadmin@amlo.go.th', // อีเมลสำหรับ Login ตัวแรก
        password: hashedPassword,
        firstname: 'System',
        lastname: 'Administrator',
        role: 'ADMIN', // กำหนดสิทธิ์เป็น ADMIN
      },
    })

    console.log(`Root Admin created: ${rootAdmin.email}`)
  } else {
    console.log('Admin already exists. Skipping...')
  }

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
