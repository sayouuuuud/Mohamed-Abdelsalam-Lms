import { StudentCoursesPage } from '@/components/student/courses/student-courses-page'
import { getEnrolledMonthlyCourses } from '@/lib/student-lectures-data'

export default async function Page() {
  const courses = await getEnrolledMonthlyCourses()
  return <StudentCoursesPage courses={courses} />
}
