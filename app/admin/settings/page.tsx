import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { getSettings, getAdminProfile, getSiteContentForAdmin, getPlatformSettings } from './actions'
import { isCurrentUserFullAdmin, listAssistants } from './assistants-actions'
import { getStreamingSettings } from '@/lib/video-actions'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const [initialSettings, adminProfile, siteContent, platformSettings, isFullAdmin] =
    await Promise.all([
      getSettings(),
      getAdminProfile(),
      getSiteContentForAdmin(),
      getPlatformSettings(),
      isCurrentUserFullAdmin(),
    ])

  const initialAssistants = isFullAdmin ? await listAssistants() : []

  // تحميل بيانات الـ Streaming للأدمن الكامل فقط
  let streamingSettings = null
  let streamingJobs: any[] = []
  let streamingVideos: any[] = []

  if (isFullAdmin) {
    const supabase = await createClient()
    const [settingsRes, jobsRes, videosRes] = await Promise.all([
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
    streamingSettings = settingsRes
    streamingJobs = (jobsRes.data ?? []) as any[]
    streamingVideos = (videosRes.data ?? []) as any[]
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      <SettingsPanel
        initialSettings={initialSettings}
        adminProfile={adminProfile}
        initialSiteContent={siteContent}
        initialPlatformSettings={platformSettings}
        initialStreamingSettings={streamingSettings}
        initialStreamingJobs={streamingJobs}
        initialStreamingVideos={streamingVideos}
        isFullAdmin={isFullAdmin}
        initialAssistants={initialAssistants}
      />
    </div>
  )
}
