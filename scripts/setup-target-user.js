require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })

async function main() {
  console.log('--- 🔧 เริ่มต้น Setup ข้อมูลเป้าหมาย (test@amlo.go.th) ---')
  try {
    const targetEmail = 'test@amlo.go.th'
    const res = await pool.query(`SELECT "id" FROM "User" WHERE email = $1`, [targetEmail])
    
    if (res.rows.length === 0) {
      console.log(`❌ ไม่พบผู้ใช้ ${targetEmail} ในฐานข้อมูล กรุณาสร้างก่อนรันเทสต์`)
      process.exit(1)
    }

    const userId = res.rows[0].id

    // 0. Revert main user back to ADMIN and update password
    const adminHash = await bcrypt.hash('AmloTest@2026!', 10)
    await pool.query(`
      UPDATE "User" 
      SET role = 'ADMIN',
          password = $1,
          "twoFactorEnabled" = false
      WHERE email = 's6604062663124@email.kmutnb.ac.th'
    `, [adminHash])

    // 0.0 Setup north@amlo.go.th as ADMIN
    const northHash = await bcrypt.hash('AmloTest@2026!', 10)
    await pool.query(`
      UPDATE "User" 
      SET password = $1,
          role = 'ADMIN',
          "twoFactorEnabled" = false,
          status = 'Active'
      WHERE email = 'north@amlo.go.th'
    `, [northHash])
    console.log('✅ ตั้งค่า north@amlo.go.th คืนกลับเป็น ADMIN สำเร็จ')

    // 0.1 Ensure tanut02059 has Test1234 password
    const testHash = await bcrypt.hash('AmloTest@2026!', 10)
    await pool.query(`
      UPDATE "User" 
      SET password = $1
      WHERE email = 'tanut02059@gmail.com'
    `, [testHash])

    // 1. อัปเดตข้อมูลเป้าหมายและรหัสผ่าน
    const testTargetHash = await bcrypt.hash('AmloTest@2026!', 10)
    await pool.query(`
      UPDATE "User" 
      SET status = 'Active',
          password = $2,
          role = 'SUPERVISOR',
          "twoFactorEnabled" = true,
          "twoFactorSecret" = 'JBSWY3DPEHPK3PXP',
          "twoFactorMethod" = 'AUTHENTICATOR',
          "forcePasswordReset" = false
      WHERE id = $1
    `, [userId, testTargetHash])
    console.log(`✅ อัปเดตสถานะเป็น Active และตั้งค่า 2FA Secret สำเร็จ`)

    // 2. ลบ Recovery Key เดิมทิ้ง (ถ้ามี)
    await pool.query(`DELETE FROM "RecoveryKey" WHERE "userId" = $1`, [userId])

    // 3. สร้าง Recovery Key ใหม่ ("RC-12345-67890") ให้ Requester
    const tanutRes = await pool.query(`SELECT "id" FROM "User" WHERE email = 'tanut02059@gmail.com'`)
    const tanutId = tanutRes.rows[0].id

    const rawKey = 'RC-12345-67890'
    const keyForHash = rawKey.replace(/-/g, '').toUpperCase()
    const salt = await bcrypt.genSalt(10)
    const keyHash = await bcrypt.hash(keyForHash, salt)
    
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    await pool.query(`DELETE FROM "RecoveryKey" WHERE "userId" = $1`, [tanutId])
    await pool.query(`
      INSERT INTO "RecoveryKey" (id, "userId", "keyHash", "createdAt", "expiresAt") 
      VALUES ($1, $2, $3, NOW(), $4)
    `, [crypto.randomUUID(), tanutId, keyHash, expiresAt])
    console.log(`✅ สร้าง Recovery Key ใหม่สำเร็จ (Raw: ${rawKey}) สำหรับ Requester`)

    // 4. เคลียร์ Supervisor Requests เดิมของ test@amlo.go.th
    try {
      await pool.query(`DELETE FROM "SupervisorRequest" WHERE "targetId" = $1 OR "requesterId" = $1`, [userId])
    } catch(e) {}
    console.log(`✅ ล้างข้อมูลคำร้องเก่าสำเร็จ`)

    console.log('--- ✨ Setup เสร็จสมบูรณ์ ---')
  } catch (error) {
    console.error('❌ Error in setup:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
