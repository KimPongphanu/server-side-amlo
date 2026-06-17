require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })

async function main() {
  try {
    const res = await pool.query(`SELECT "id", "email", "recoveryKey" FROM "User" WHERE email = 'test@amlo.go.th'`)
    if (res.rows.length > 0) {
      console.log('--- USER DATA ---')
      console.log(`ID: ${res.rows[0].id}`)
      console.log(`Email: ${res.rows[0].email}`)
      console.log(`RecoveryKey: ${res.rows[0].recoveryKey}`)
    } else {
      console.log('User not found')
    }
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await pool.end()
  }
}

main()
