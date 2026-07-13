import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/student',
          '/auth',
          '/api/',
          '/*/watch/',
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
