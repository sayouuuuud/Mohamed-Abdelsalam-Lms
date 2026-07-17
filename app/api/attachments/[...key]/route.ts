import { type NextRequest, NextResponse } from 'next/server'
import { createR2DownloadUrl, r2ObjectExists } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { key: string[] }

export async function GET(
  req: NextRequest,
  context: { params: Promise<Params> },
): Promise<NextResponse> {
  const { key } = await context.params
  const objectKey = key.join('/')

  // Validate it's an attachment
  if (!objectKey.startsWith('attachments/')) {
    return NextResponse.json({ error: 'المسار غير صحيح' }, { status: 400 })
  }

  // Generate a presigned URL that is valid for 1 hour
  try {
    // Check if it exists first to return 404 cleanly
    if (!(await r2ObjectExists(objectKey))) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    }

    const signedUrl = await createR2DownloadUrl(objectKey, 3600)
    return NextResponse.redirect(signedUrl, 302)
  } catch (error) {
    console.error('[attachments] Download error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الملف' }, { status: 500 })
  }
}
