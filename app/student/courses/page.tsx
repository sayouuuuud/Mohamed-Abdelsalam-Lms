import { StudentCoursesPage } from '@/components/student/courses/student-courses-page'
import { getEnrolledMonthlyCourses } from '@/lib/student-lectures-data'
import { getStudentEnrolledCourses } from '@/app/student/actions'

export default async function Page() {
  const [courses, lectures] = await Promise.all([
    getEnrolledMonthlyCourses(),
    getStudentEnrolledCourses(),
  ])
  return <StudentCoursesPage courses={courses} lectures={lectures} />
}
