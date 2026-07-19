import { ImageResponse } from 'next/og'
import { getCourseBySlug } from '@/lib/curriculum'
import { getSiteContent } from '@/lib/site-content'
import { loadCairoFonts } from '@/lib/og-fonts'

export const runtime     = 'nodejs'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt         = 'صورة الكورس'

export default async function Image({
  params,
}: {
  params: Promise<{ id: string; branchId: string; courseId: string }>
}) {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const branchId = decodeURIComponent(paramsObj.branchId)
  const courseId = decodeURIComponent(paramsObj.courseId)
  const [result, { seo }, fonts] = await Promise.all([
    getCourseBySlug(id, branchId, courseId),
    getSiteContent(),
    loadCairoFonts(),
  ])

  const courseTitle  = result?.course.title  ?? 'الكورس'
  const branchTitle  = result?.branch.title  ?? ''
  const stageTitle   = result?.stage.title   ?? ''
  const price        = result?.course.price  ?? 0
  const siteName     = seo.title
  const priceLabel   = price === 0 ? 'مجاني' : `${price} جنيه`

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
          backgroundColor: '#0f172a',
          padding: '60px 80px',
          fontFamily: 'Cairo',
        }}
      >
        {/* breadcrumb */}
        <div style={{ display: 'flex', gap: '8px', color: '#64748b', fontSize: 24, marginBottom: '24px' }}>
          <span>{stageTitle}</span>
          <span>{'←'}</span>
          <span>{branchTitle}</span>
        </div>

        {/* عنوان الكورس */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'right',
            lineHeight: 1.25,
            marginBottom: '28px',
            maxWidth: '1000px',
          }}
        >
          {courseTitle}
        </div>

        {/* شارة السعر */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#d4a847',
            color: '#0f172a',
            padding: '10px 28px',
            borderRadius: '40px',
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {priceLabel}
        </div>

        {/* اسم الموقع */}
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            left: '80px',
            fontSize: 22,
            color: '#64748b',
          }}
        >
          {siteName}
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  )
}
