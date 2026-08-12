import { notFound } from 'next/navigation'
import { AssignmentDetailsHeader } from '@/components/assignments/assignment-details-header'
import { AssignmentSubmissionsTable } from '@/components/assignments/assignment-submissions-table'
import { getAssignmentDetails } from '../actions'

export default async function AssignmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assignment = await getAssignmentDetails(id)
  if (!assignment) notFound()

  return (
    <div className="space-y-6 font-sans">
      <AssignmentDetailsHeader assignment={assignment} />
      <AssignmentSubmissionsTable
        submissions={assignment.submissions}
        assignmentCode={assignment.code}
        maxPoints={assignment.points}
      />
    </div>
  )
}
