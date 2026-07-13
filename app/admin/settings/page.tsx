import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { getSettings, getAdminProfile, getSiteContentForAdmin, getPlatformSettings } from './actions'
import { isCurrentUserFullAdmin, listAssistants } from './assistants-actions'

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

  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      <SettingsPanel
        initialSettings={initialSettings}
        adminProfile={adminProfile}
        initialSiteContent={siteContent}
        initialPlatformSettings={platformSettings}
        isFullAdmin={isFullAdmin}
        initialAssistants={initialAssistants}
      />
    </div>
  )
}
