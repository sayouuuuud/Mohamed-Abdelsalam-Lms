import { ExamsPageHeader } from '@/components/exams/exams-page-header'
import { ExamsStats } from '@/components/exams/exams-stats'
import { ExamsTable } from '@/components/exams/exams-table'
import { getExams, getExamsStats } from './actions'

export default async function ExamsPage() {
  const [exams, stats] = await Promise.all([getExams(), getExamsStats()])

  return (
    <>
      <ExamsPageHeader exams={exams} />
      <ExamsStats stats={stats} />
      <ExamsTable initialExams={exams} />
    </>
  )
}
