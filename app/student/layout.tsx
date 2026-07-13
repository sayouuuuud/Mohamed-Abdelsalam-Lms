import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { StudentLayout as LayoutComponent } from '@/components/student/student-layout'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import { StudentProvider } from '@/components/student/student-context'
import {
  getStudentProfile,
  getStudentEnrolledCourses,
  getStudentUpcomingSchedule,
  getStudentRecentGrades,
  getStudentAnnouncements,
  getStudentLearningActivity,
  getAvailableStagesMinimal
} from './actions'
import { ForceGradeSelection } from '@/components/student/force-grade-selection'
import { PresenceHeartbeat } from '@/components/student/presence-heartbeat'

import { BlockedUser } from '@/components/student/blocked-user'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  // Fetch the portal data in parallel instead of a slow sequential waterfall.
  const [profile, enrolledCourses, schedule, grades, announcements, activity, stages] =
    await Promise.all([
      getStudentProfile(),
      getStudentEnrolledCourses(),
      getStudentUpcomingSchedule(),
      getStudentRecentGrades(),
      getStudentAnnouncements(),
      getStudentLearningActivity(),
      getAvailableStagesMinimal(),
    ])

  // Fallback profile if not found
  const defaultProfile: import('@/lib/student-types').StudentProfileInfo = {
    name: 'طالب غير مسجل',
    email: '',
    phone: '',
    avatarUrl: null,
    initials: 'ط',
    code: '',
    stageTitle: '',
    level: '',
  }

  const resolvedProfile = profile ?? defaultProfile

  if (resolvedProfile.status === 'موقوف') {
    return <BlockedUser />
  }

  return (
    <StudentProvider data={{
      profile: resolvedProfile,
      enrolledCourses,
      schedule,
      grades,
      announcements,
      activity
    }}>
      <LayoutComponent>{children}</LayoutComponent>
      {profile && <PresenceHeartbeat />}
      {profile && !profile.stageTitle && (
        <ForceGradeSelection stages={stages} />
      )}
    </StudentProvider>
  )
}
