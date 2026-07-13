import { ImageResponse } from 'next/og'
import { getStageBySlug } from '@/lib/curriculum'
import { getSiteContent } from '@/lib/site-content'

export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt         = 'صورة المرحلة الدراسية'

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [stage, { seo }] = await Promise.all([getStageBySlug(id), getSiteContent()])

  const title    = stage?.title    ?? 'المرحلة الدراسية'
  const subtitle = stage?.subtitle ?? seo.description
  const siteName = seo.title

  // حمّل خط Cairo عربي من Google Fonts
  let fontData: ArrayBuffer | null = null
  try {
    const res = await fetch(
      'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvalIhTp2mxdt0UX8.woff2',
      { next: { revalidate: 86400 } },
    )
    fontData = await res.arrayBuffer()
  } catch {
    // يفضل بدون خط — مقبول
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-end',
          backgroundColor: '#1a1f33',
          padding: '60px 80px',
          fontFamily: fontData ? 'Cairo' : 'sans-serif',
        }}
      >
        {/* خط ذهبي علوي */}
        <div style={{ width: '80px', height: '4px', backgroundColor: '#d4a847', marginBottom: '32px' }} />

        {/* عنوان المرحلة */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'right',
            lineHeight: 1.2,
            marginBottom: '16px',
          }}
        >
          {title}
        </div>

        {/* الوصف */}
        <div
          style={{
            fontSize: 32,
            color: '#94a3b8',
            textAlign: 'right',
            lineHeight: 1.4,
            maxWidth: '900px',
          }}
        >
          {typeof subtitle === 'string' ? subtitle.slice(0, 100) : ''}
        </div>

        {/* اسم الموقع */}
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            left: '80px',
            fontSize: 24,
            color: '#d4a847',
          }}
        >
          {siteName}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'Cairo', data: fontData, weight: 700, style: 'normal' }]
        : [],
    },
  )
}
