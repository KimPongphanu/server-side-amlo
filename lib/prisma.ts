// lib/prisma.js
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

// กำหนด Client ตัวกลางเพื่อนำไปใช้แชร์ร่วมกันทั้งโปรเจกต์
const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'], // ล็อกตรวจสอบการ Query
})

export default prisma
