import { getLecturesAdmin, getBranchOptions } from './actions'
import { getCurriculumAdmin } from '@/app/admin/categories/actions'
import { LecturesProvider } from '@/components/courses/lectures-context'
import { CurriculumProvider } from '@/components/categories/curriculum-context'
import { LecturesPageHeader } from '@/components/courses/lectures-page-header'
import { CoursesLecturesTabs } from '@/components/courses/courses-lectures-tabs'
import { LectureFormModals } from '@/components/courses/lecture-form-modals'
import { CurriculumFormModals } from '@/components/categories/curriculum-form-modals'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const [lectures, branchOptions, stages] = await Promise.all([
    getLecturesAdmin(),
    getBranchOptions(),
    getCurriculumAdmin(),
  ])

  return (
    <CurriculumProvider initialStages={stages}>
      <LecturesProvider initialLectures={lectures} branchOptions={branchOptions}>
        <div className="space-y-6">
          <LecturesPageHeader />
          <CoursesLecturesTabs />
        </div>
        <LectureFormModals />
        <CurriculumFormModals />
      </LecturesProvider>
    </CurriculumProvider>
  )
}
