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

  let body: { videoId?: string; lessonId?: string; status?: string; errorMsg?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { videoId, lessonId, status, errorMsg } = body

  if (!videoId || !status) {
    return NextResponse.json({ error: 'videoId و status مطلوبان' }, { status: 400 })
  }

  const supabase = await createClient()
  const now      = new Date().toISOString()

  if (status === 'ready') {
    // تحديث lessons.video_status = ready لو موجود
    if (lessonId) {
      await supabase
        .from('lessons')
        .update({ video_status: 'ready', updated_at: now })
        .eq('video_id', videoId)
    }
    return NextResponse.json({ ok: true })
  }

  if (status === 'error') {
    // تسجيل الفشل على الـ lesson عشان الأدمن يشوفه في اللوحة
    if (lessonId) {
      await supabase
        .from('lessons')
        .update({ video_status: 'error', updated_at: now })
        .eq('video_id', videoId)
    }
    console.error(`[webhook/video-ready] فشل تحويل video ${videoId}:`, errorMsg)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `status غير معروف: ${status}` }, { status: 400 })
}
