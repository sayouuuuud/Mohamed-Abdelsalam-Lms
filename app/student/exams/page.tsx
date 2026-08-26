import { StudentExamsPage } from '@/components/student/exams/student-exams-page'
import { getStudentExams } from '../actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const exams = await getStudentExams()

  return (
      <StudentExamsPage exams={exams} />
  )
}
