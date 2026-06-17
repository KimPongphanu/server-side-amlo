require('dotenv').config()
const { Pool } = require('pg')
const speakeasy = require('speakeasy')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })

async function main() {
  const email = process.argv[2] || 'tanut02059@gmail.com'
  try {
    const res = await pool.query(`SELECT "twoFactorSecret" FROM "User" WHERE email = $1`, [email])
    if (res.rows.length > 0 && res.rows[0].twoFactorSecret) {
      console.log(speakeasy.totp({ secret: res.rows[0].twoFactorSecret, encoding: 'base32' }))
    } else {
      console.log('')
    }
  } catch (err) {
    console.error(err)
  } finally {
    pool.end()
  }
}
main()
