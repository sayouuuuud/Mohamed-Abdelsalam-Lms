import { StudentDashboardShell } from '@/components/student/student-dashboard-shell'
import {
  getStudentEnrolledCourses,
  getStudentUpcomingSchedule,
  getStudentRecentGrades,
  getStudentAnnouncements,
  getStudentLearningActivity
} from './actions'

export const dynamic = 'force-dynamic'

export default async function StudentPage() {
  const enrolledCourses = await getStudentEnrolledCourses()
  const schedule = await getStudentUpcomingSchedule()
  const grades = await getStudentRecentGrades()
  const announcements = await getStudentAnnouncements()
  const activity = await getStudentLearningActivity()

  return (
    <StudentDashboardShell 
      enrolledCourses={enrolledCourses}
      schedule={schedule}
      grades={grades}
      announcements={announcements}
      activity={activity}
    />
  )
}
