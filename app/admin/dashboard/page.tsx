import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getDashboardData } from './actions'

export default async function Page({
  searchParams,
}: {
  searchParams: { range?: string }
}) {
  const range = searchParams.range || '30d'
  const data = await getDashboardData(range)
  return <DashboardShell data={data} />
}
