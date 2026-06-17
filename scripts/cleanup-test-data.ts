import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('\n🧹 [Teardown] Starting Database Cleanup for E2E Tests...')
  
  try {
    // 1. Delete News & PR
    const newsRes = await prisma.news.deleteMany({
      where: { title: { contains: '[Automated Test]' } }
    })
    console.log(`  🗑️ Deleted ${newsRes.count} News/PR items.`)

    // 2. Delete Departments
    const deptRes = await prisma.department.deleteMany({
      where: { title: { contains: '[Automated Test]' } }
    })
    console.log(`  🗑️ Deleted ${deptRes.count} Department items.`)

    // 3. Delete Sliders (Assuming the test image is named 'dummy.png' or similar)
    const sliderRes = await prisma.slider_images.deleteMany({
      where: { image_url: { contains: 'dummy' } }
    })
    console.log(`  🗑️ Deleted ${sliderRes.count} Slider items.`)

    console.log('✨ [Teardown] Cleanup Complete!\n')
  } catch (error) {
    console.error('💥 [Teardown] Error during cleanup:', error)
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
