import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { getSettings, getAdminProfile, getSiteContentForAdmin } from './actions'

export default async function SettingsPage() {
  const [initialSettings, adminProfile, siteContent] = await Promise.all([
    getSettings(),
    getAdminProfile(),
    getSiteContentForAdmin(),
  ])

  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      <SettingsPanel
        initialSettings={initialSettings}
        adminProfile={adminProfile}
        initialSiteContent={siteContent}
      />
    </div>
  )
}
