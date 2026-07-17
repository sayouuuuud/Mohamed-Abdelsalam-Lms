/**
 * POST /api/webhooks/video-ready
 *
 * يستقبل إشارة من الوركر بعد اكتمال التحويل.
 * الوركر يبعت: { videoId, lessonId, status: 'ready' | 'error', errorMsg? }
 *
 * الأمان:
 *   - يتحقق من WORKER_WAKE_SECRET في Authorization header
 *   - لو SECRET غير مضبوط → يرفض كل الطلبات (fail-safe)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECRET = process.env.WORKER_WAKE_SECRET ?? ''

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!SECRET) {
    return NextResponse.json({ error: 'WORKER_WAKE_SECRET غير مضبوط على السيرفر' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    videoId?: string
    lessonId?: string
    status?: string
    errorMsg?: string
    durationSec?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { videoId, lessonId, status, errorMsg, durationSec } = body

  if (!videoId || !status) {
    return NextResponse.json({ error: 'videoId و status مطلوبان' }, { status: 400 })
  }

  if (status === 'ready') {
    const videoUpdate: any = { status: 'ready', updated_at: new Date() }
    if (durationSec && durationSec > 0) videoUpdate.duration_sec = durationSec

    await prisma.videos.update({
      where: { id: videoId },
      data: videoUpdate
    })

    if (lessonId || videoId) {
      const lessonUpdate: any = { updated_at: new Date() }
      if (durationSec && durationSec > 0) {
        const m = Math.floor(durationSec / 60)
        const s = durationSec % 60
        lessonUpdate.duration = s > 0 ? `${m}:${String(s).padStart(2, '0')} دقيقة` : `${m} دقيقة`
      }
      await prisma.lessons.updateMany({
        where: { video_id: videoId },
        data: lessonUpdate
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (status === 'error') {
    await prisma.videos.update({
      where: { id: videoId },
      data: { status: 'error', error_message: errorMsg ?? null, updated_at: new Date() }
    })
    console.error(`[webhook/video-ready] فشل تحويل video ${videoId}:`, errorMsg)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `status غير معروف: ${status}` }, { status: 400 })
}
