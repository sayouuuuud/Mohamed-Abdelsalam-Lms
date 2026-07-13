import type { MetadataRoute } from 'next'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

export default function manifest(): MetadataRoute.Manifest {
  // نستخدم DEFAULT_SITE_CONTENT لأن manifest يُولَّد وقت البناء (static)
  // ولا يدعم async في Next.js حتى الآن
  const siteName = DEFAULT_SITE_CONTENT.seo.title

  return {
    name: siteName,
    short_name: 'رياضيات',
    description: DEFAULT_SITE_CONTENT.seo.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#1a1f33',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
