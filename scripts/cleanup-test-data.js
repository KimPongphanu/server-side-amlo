require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })

async function main() {
  console.log('\n🧹 [Teardown] Starting Database Cleanup for E2E Tests...')
  
  try {
    const newsRes = await pool.query(`DELETE FROM "News" WHERE title LIKE '%[Automated Test]%'`)
    console.log(`  🗑️ Deleted ${newsRes.rowCount} News/PR items.`)

    const deptRes = await pool.query(`DELETE FROM "Department" WHERE title LIKE '%[Automated Test]%'`)
    console.log(`  🗑️ Deleted ${deptRes.rowCount} Department items.`)

    const sliderRes = await pool.query(`DELETE FROM slider_images WHERE image_url LIKE '%dummy%'`)
    console.log(`  🗑️ Deleted ${sliderRes.rowCount} Slider items.`)

    const contactRes = await pool.query(`DELETE FROM "contact_requests" WHERE "first_name" LIKE '%AutoSomchai%'`)
    console.log(`  🗑️ Deleted ${contactRes.rowCount} Contact Requests.`)

    const commentRes = await pool.query(`DELETE FROM "comment_items" WHERE "msg" LIKE '%[Automated Test]%'`)
    console.log(`  🗑️ Deleted ${commentRes.rowCount} Review/Comments.`)

    console.log('✨ [Teardown] Cleanup Complete!\n')
  } catch (error) {
    console.error('💥 [Teardown] Error during cleanup:', error)
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => pool.end())
