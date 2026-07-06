import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { getSettings, getAdminProfile, getSiteContentForAdmin } from './actions'
import { isCurrentUserFullAdmin, listAssistants } from './assistants-actions'

export default async function SettingsPage() {
  const [initialSettings, adminProfile, siteContent, isFullAdmin] =
    await Promise.all([
      getSettings(),
      getAdminProfile(),
      getSiteContentForAdmin(),
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
        isFullAdmin={isFullAdmin}
        initialAssistants={initialAssistants}
      />
    </div>
  )
}
