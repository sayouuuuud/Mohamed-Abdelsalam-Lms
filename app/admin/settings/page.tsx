import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { getSettings, getAdminProfile, getSiteContentForAdmin, getPlatformSettings } from './actions'
import { isCurrentUserFullAdmin, listAssistants } from './assistants-actions'
import { getStreamingSettings } from '@/lib/video-actions'
import { prisma } from '@/lib/prisma'

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
    const [settingsRes, jobsRes, videosRes] = await Promise.all([
      getStreamingSettings(),
      prisma.video_jobs.findMany({
        select: { id: true, status: true, attempts: true, created_at: true, updated_at: true, video_id: true },
        orderBy: { created_at: 'desc' },
        take: 50
      }),
      prisma.videos.findMany({
        select: { id: true, lesson_id: true, status: true, duration_sec: true, file_size_bytes: true, created_at: true, r2_hls_prefix: true, error_message: true },
        orderBy: { created_at: 'desc' },
        take: 50
      })
    ])
    streamingSettings = settingsRes
    streamingJobs = jobsRes
    streamingVideos = videosRes
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
