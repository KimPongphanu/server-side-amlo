require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function check() {
  const res = await pool.query(`SELECT email, status, role, "twoFactorEnabled", "twoFactorSecret" FROM "User"`)
  console.log(res.rows)
  pool.end()
}
check()
