import { notFound } from 'next/navigation'
import { StudentProfileView } from '@/components/students/profile/student-profile'
import { getStudentProfileData } from './actions'

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getStudentProfileData(id)

  if (!profile) {
    notFound()
  }

  return <StudentProfileView profile={profile} studentDbId={profile.studentDbId} />
}
