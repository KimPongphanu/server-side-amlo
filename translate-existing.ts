import prisma from './lib/prisma'
import { translate } from '@vitalets/google-translate-api'

const translateToEnglish = async (text: string | null | undefined): Promise<string | null> => {
  if (!text || text.trim() === '') {
    return text || null
  }
  try {
    const res = await translate(text, { to: 'en' })
    return res.text
  } catch (error: any) {
    console.error(`[Translate Error]: Failed to translate text`, error.message)
    return text
  }
}

async function main() {
  console.log('Starting translation of existing data...')

  // 1. Translate Departments
  const allDepartments = await prisma.department.findMany()
  console.log(`Found ${allDepartments.length} total departments.`)
  for (const d of allDepartments) {
    console.log(`- ${d.title} | title_en: '${d.title_en}'`)
  }

  const departments = await prisma.department.findMany({
    where: {
      OR: [
        { title_en: null },
        { title_en: '' },
      ]
    },
  })
  console.log(`Found ${departments.length} departments to translate.`)

  for (const dept of departments) {
    console.log(`Translating Department: ${dept.title}`)
    const title_en = await translateToEnglish(dept.title)
    const content_en = await translateToEnglish(dept.content)
    await prisma.department.update({
      where: { id: dept.id },
      data: {
        title_en,
        content_en,
      },
    })
  }

  // 2. Translate News
  const allNews = await prisma.news.findMany()
  console.log(`Found ${allNews.length} total news items.`)
  for (const n of allNews) {
    console.log(`- ${n.title} | title_en: '${n.title_en}'`)
  }

  const news = await prisma.news.findMany({
    where: {
      OR: [
        { title_en: null },
        { title_en: '' },
      ]
    },
  })
  console.log(`Found ${news.length} news items to translate.`)

  for (const item of news) {
    console.log(`Translating News: ${item.title}`)
    const title_en = await translateToEnglish(item.title)
    const description_en = await translateToEnglish(item.description)
    const content_en = await translateToEnglish(item.content)
    await prisma.news.update({
      where: { id: item.id },
      data: {
        title_en,
        description_en,
        content_en,
      },
    })
  }

  console.log('Translation completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
