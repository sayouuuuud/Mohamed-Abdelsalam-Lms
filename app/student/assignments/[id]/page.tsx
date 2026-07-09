import { notFound, redirect } from 'next/navigation'
import { AssignmentDetail } from '@/components/student/assignments/assignment-detail'
import { getPurchasedAssignment } from '@/lib/student-lectures-data'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const id = decodeURIComponent((await params).id)

  const real = await getPurchasedAssignment(id)
  if (!real) notFound()

  // Sequential gating: can't open a locked assignment yet.
  if (real.assignment.locked && real.course) {
    redirect(`/student/courses/${real.course.id}`)
  }

  return <AssignmentDetail assignment={real.assignment} course={real.course} />
}
