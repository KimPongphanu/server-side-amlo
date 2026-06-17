import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const allNews = await prisma.news.findMany({ select: { id: true, title: true }})
  console.log('ALL NEWS:')
  console.log(allNews)
}

main().finally(() => prisma.$disconnect())
