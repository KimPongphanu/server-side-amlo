import asyncHandler from 'express-async-handler'
import { Request, Response } from 'express'
import prisma from '../lib/prisma'

const STATIC_PATHS: Array<{
  path: string
  changefreq: string
  priority: string
}> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/news', changefreq: 'daily', priority: '0.9' },
  { path: '/advertise', changefreq: 'daily', priority: '0.9' },
  { path: '/about/history', changefreq: 'monthly', priority: '0.6' },
  { path: '/contactform', changefreq: 'yearly', priority: '0.5' },
  { path: '/commentform', changefreq: 'yearly', priority: '0.4' },
  { path: '/sitemap', changefreq: 'monthly', priority: '0.3' },
]

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      default:
        return '&quot;'
    }
  })

const toUrlEntry = ({
  loc,
  lastmod,
  changefreq,
  priority,
}: {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}): string => {
  const lines = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`]

  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`)
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority) lines.push(`    <priority>${priority}</priority>`)

  lines.push('  </url>')
  return lines.join('\n')
}

export const getSitemap = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // 🌟 SITE_URL ใช้กำหนด canonical domain (เช่น https://www.amlo.go.th)
    //    ถ้าไม่ตั้ง จะใช้ Host + X-Forwarded-Proto ของ request นั้น ๆ
    const configuredSiteUrl = (process.env.SITE_URL || '').trim()
    const host = req.get('host')
    const baseUrl = (
      configuredSiteUrl ||
      (host ? `${req.protocol}://${host}` : 'https://www.amlo.go.th')
    ).replace(/\/+$/, '')

    const [newsItems, prItems, departments] = await Promise.all([
      prisma.news.findMany({
        where: { type: 'NEWS', isShow: true },
        select: { id: true, date: true },
        orderBy: { date: 'desc' },
      }),
      prisma.news.findMany({
        where: { type: 'PR', isShow: true },
        select: { id: true, date: true },
        orderBy: { date: 'desc' },
      }),
      prisma.department.findMany({
        where: { isDelete: false },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ])

    const entries: string[] = [
      ...STATIC_PATHS.map((item) =>
        toUrlEntry({
          loc: `${baseUrl}${item.path}`,
          changefreq: item.changefreq,
          priority: item.priority,
        }),
      ),
      ...departments.map((dept: { id: number }) =>
        toUrlEntry({
          loc: `${baseUrl}/department/${dept.id}`,
          changefreq: 'monthly',
          priority: '0.7',
        }),
      ),
      ...newsItems.map((item: { id: number; date: Date }) =>
        toUrlEntry({
          loc: `${baseUrl}/news/${item.id}`,
          lastmod: item.date.toISOString(),
          changefreq: 'monthly',
          priority: '0.7',
        }),
      ),
      ...prItems.map((item: { id: number; date: Date }) =>
        toUrlEntry({
          loc: `${baseUrl}/advertise/${item.id}`,
          lastmod: item.date.toISOString(),
          changefreq: 'monthly',
          priority: '0.7',
        }),
      ),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`

    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(xml)
  },
)
