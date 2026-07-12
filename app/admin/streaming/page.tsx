import { getStreamingSettings } from '@/lib/video-actions'
import { createClient } from '@/lib/supabase/server'
import { StreamingDashboard } from './streaming-dashboard'

export const dynamic = 'force-dynamic'

export default async function StreamingPage() {
  const supabase = await createClient()

  const [settings, jobsRes, videosRes] = await Promise.all([
    getStreamingSettings(),
    supabase
      .from('video_jobs')
      .select('id, status, attempts, created_at, updated_at, video_id')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('videos')
      .select('id, lesson_id, status, duration_sec, file_size_bytes, created_at, r2_hls_prefix, error_message')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <StreamingDashboard
      settings={settings}
      jobs={(jobsRes.data ?? []) as any[]}
      videos={(videosRes.data ?? []) as any[]}
    />
  )
}
