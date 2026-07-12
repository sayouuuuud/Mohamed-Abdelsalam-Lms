import { CurriculumProvider } from '@/components/categories/curriculum-context'
import { CurriculumPageHeader } from '@/components/categories/curriculum-page-header'
import { CurriculumStats } from '@/components/categories/curriculum-stats'
import { CurriculumGrid } from '@/components/categories/curriculum-grid'
import { CurriculumFormModals } from '@/components/categories/curriculum-form-modals'
import { getCurriculumAdmin } from './actions'

export default async function CategoriesPage() {
  const stages = await getCurriculumAdmin()

  return (
    <CurriculumProvider initialStages={stages}>
      <div className="space-y-6">
        <CurriculumPageHeader />
        <CurriculumStats />
        <CurriculumGrid />
      </div>
      <CurriculumFormModals />
    </CurriculumProvider>
  )
}
