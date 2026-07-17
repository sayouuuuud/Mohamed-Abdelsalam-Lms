import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getDashboardData } from './actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await getDashboardData()
  return <DashboardShell data={data} />
}
