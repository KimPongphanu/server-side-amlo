// prisma/seed.ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config' // ✅ ต้องมีบรรทัดนี้ไว้ด้านบนสุด
import { Pool } from 'pg'

// ✅ ตรวจสอบ DATABASE_URL
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables')
  console.error('Please create a .env file with DATABASE_URL=postgresql://...')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seeding...')

  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('1234', 10)

    const rootAdmin = await prisma.user.create({
      data: {
        email: 'test@gmail.com',
        password: hashedPassword,
        firstname: 'System',
        lastname: 'Administrator',
        role: 'ADMIN',
      },
    })

    console.log(`✅ Root Admin created: ${rootAdmin.email}`)
  } else {
    console.log('⚠️ Admin already exists. Skipping...')
  }

  console.log('🌱 Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
