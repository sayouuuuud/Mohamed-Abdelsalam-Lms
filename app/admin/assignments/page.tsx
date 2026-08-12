import { AssignmentsPageHeader } from '@/components/assignments/assignments-page-header'
import { AssignmentsStats } from '@/components/assignments/assignments-stats'
import { AssignmentsTable } from '@/components/assignments/assignments-table'
import { getAssignmentsOverview, getAssignmentsStats } from './actions'

export default async function AssignmentsPage() {
  const [assignments, stats] = await Promise.all([getAssignmentsOverview(), getAssignmentsStats()])

  return (
    <div className="space-y-6 font-sans">
      <AssignmentsPageHeader assignments={assignments} />
      <AssignmentsStats stats={stats} />
      <AssignmentsTable assignments={assignments} />
    </div>
  )
}
