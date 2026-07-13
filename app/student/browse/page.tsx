import { StudentBrowsePage } from '@/components/student/browse/student-browse-page'
import { getCurriculum } from '@/lib/curriculum'
import { getStudentProfile, getStudentEnrolledCourses } from '@/app/student/actions'

export default async function BrowsePage() {
  const [stages, profile, enrolledCourses] = await Promise.all([
    getCurriculum(),
    getStudentProfile(),
    getStudentEnrolledCourses(),
  ])

  // The student's grade (sec-1/sec-2/sec-3) matches the stage slug. Show only
  // the lectures for the student's own grade; fall back to everything if the
  // grade isn't set or doesn't match any stage.
  // stageTitle is the resolved stage name; match against stage.title or .id
  const grade: string | undefined = profile?.stageTitle || undefined
  const ownStage = grade ? stages.find((s) => s.id === grade) : undefined
  const visibleStages = ownStage ? [ownStage] : stages
  const purchasedCourseIds = enrolledCourses.map(c => c.id)

  return <StudentBrowsePage stages={visibleStages} gradeLocked={!!ownStage} purchasedCourseIds={purchasedCourseIds} />
}
