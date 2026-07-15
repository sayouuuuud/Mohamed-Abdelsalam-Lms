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
import { createClient } from '@/lib/supabase/server'

const SECRET = process.env.WORKER_WAKE_SECRET ?? ''

export async function POST(req: NextRequest): Promise<NextResponse> {
  // تحقق من السر
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

  const supabase = await createClient()
  const now = new Date().toISOString()

  if (status === 'ready') {
    // 1. تحديث videos table بـ duration_sec وstatus
    const videoUpdate: Record<string, unknown> = { status: 'ready', updated_at: now }
    if (durationSec && durationSec > 0) videoUpdate.duration_sec = durationSec
    await supabase.from('videos').update(videoUpdate).eq('id', videoId)

    // 2. تحديث lessons المرتبطة:
    //    - video_status = 'ready'
    //    - duration: لو موفّر من الـ worker، حوّله لصيغة "دق:ثا" عشان يظهر في الـ player
    if (lessonId || videoId) {
      const lessonUpdate: Record<string, unknown> = { updated_at: now }
      if (durationSec && durationSec > 0) {
        const m = Math.floor(durationSec / 60)
        const s = durationSec % 60
        lessonUpdate.duration = s > 0 ? `${m}:${String(s).padStart(2, '0')} دقيقة` : `${m} دقيقة`
      }
      await supabase
        .from('lessons')
        .update(lessonUpdate)
        .eq('video_id', videoId)
    }
    return NextResponse.json({ ok: true })
  }

  if (status === 'error') {
    await supabase
      .from('videos')
      .update({ status: 'error', error_message: errorMsg ?? null, updated_at: now })
      .eq('id', videoId)
    console.error(`[webhook/video-ready] فشل تحويل video ${videoId}:`, errorMsg)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `status غير معروف: ${status}` }, { status: 400 })
}
