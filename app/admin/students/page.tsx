import { StudentsProvider } from '@/components/students/students-context'
import { StudentsPageHeader } from '@/components/students/students-page-header'
import { StudentsStats } from '@/components/students/students-stats'
import { StudentsTable } from '@/components/students/students-table'
import { StudentFormModal } from '@/components/students/student-form-modal'
import { getStudents, getStages, getStudentsStats } from './actions'

export default async function StudentsPage() {
  const [students, stages, stats] = await Promise.all([getStudents(), getStages(), getStudentsStats()])

  return (
    <StudentsProvider initialStudents={students} stages={stages}>
      <StudentsPageHeader />
      <StudentsStats stats={stats} />
      <StudentsTable />
      <StudentFormModal />
    </StudentsProvider>
  )
}
