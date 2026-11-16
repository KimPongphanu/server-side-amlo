// services/securityAlertService.ts
// แจ้งเตือน Supervisor เมื่อมีเหตุการณ์สำคัญต่อบัญชี admin
// 🌟 นี่คือ control หลักที่ทำหน้าที่แทน email OTP เดิม (แจ้งให้คนเห็น ไม่ใช่กันที่ตัวผู้ใช้)
import prisma from '../lib/prisma'
import { sendEmail } from './emailService'
import { escapeHtml } from '../utils/escapeHtml'

const SUBJECT_PREFIX = '[SECURITY]'

interface SupervisorContact {
  email: string
  firstname: string
  lastname: string
}

/**
 * ส่งอีเมลแจ้งเตือนไปยัง Supervisor ทุกคน (สูงสุด 2 ท่านตามข้อกำหนดระบบ)
 * best-effort: ถ้าส่งไม่ได้ต้องไม่ทำให้ flow หลักล้มเหลว
 */
export const notifySupervisors = async (
  action: string,
  message: string,
  details: string,
): Promise<void> => {
  try {
    const supervisors: SupervisorContact[] = await prisma.user.findMany({
      where: { role: 'SUPERVISOR', status: 'Active' },
      select: { email: true, firstname: true, lastname: true },
    })

    if (supervisors.length === 0) return

    const html = `
      <h2>⚠️ ${escapeHtml(action)}</h2>
      <p>Dear Supervisor,</p>
      <p>${escapeHtml(message)}</p>
      <h3>Details:</h3>
      <ul>
        <li>${escapeHtml(details)}</li>
        <li>Time: ${new Date().toLocaleString('th-TH')}</li>
      </ul>
      <p>หากคุณไม่ได้ดำเนินการหรืออนุมัติเหตุการณ์นี้ กรุณาตรวจสอบบัญชีผู้ดูแลระบบทันที</p>
      <hr>
      <p><small>Anti-Money Laundering Office (AMLO)</small></p>
    `

    await Promise.all(
      supervisors.map((supervisor) =>
        sendEmail({
          to: supervisor.email,
          subject: `${SUBJECT_PREFIX} ${action}`,
          html,
        }).catch((err) => {
          console.error(
            `[SecurityAlert] ส่งอีเมลถึง ${supervisor.email} ไม่สำเร็จ:`,
            err,
          )
        }),
      ),
    )
  } catch (error) {
    console.error('[SecurityAlert] แจ้งเตือน Supervisor ไม่สำเร็จ:', error)
  }
}
