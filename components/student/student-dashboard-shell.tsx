'use client'

import { StudentLayout } from './student-layout'
import { StudentWelcome } from './student-welcome'
import { StudentStats } from './student-stats'
import { ContinueLearning } from './continue-learning'
import { MyCourses } from './my-courses'
import { UpcomingSchedule } from './upcoming-schedule'
import { RecentGrades } from './recent-grades'
import { LearningActivityChart } from './learning-activity-chart'
import type { ActivityDay, CourseProgress, ScheduleItem, GradeItem, Announcement } from '@/lib/student-types'
import { Announcements } from './announcements'
import { UpcomingExams } from './upcoming-exams'
import { PendingAssignments } from './pending-assignments'
import { MonthlyProgress } from './monthly-progress'

export function StudentDashboardShell({
  enrolledCourses,
  schedule,
  grades,
  announcements,
  activity,
}: {
  enrolledCourses: CourseProgress[]
  schedule: ScheduleItem[]
  grades: GradeItem[]
  announcements: Announcement[]
  activity: ActivityDay[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <StudentWelcome />
      <StudentStats courses={enrolledCourses} grades={grades} activity={activity} />

      {/* Row 1: أكمل من حيث توقفت (wide) + الاختبارات القادمة */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ContinueLearning courses={enrolledCourses} />
        </div>
        <div className="xl:col-span-1">
          <UpcomingExams schedule={schedule} />
        </div>
      </div>

      {/* Row 2: الجدول + نشاط التعلم (wide) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <UpcomingSchedule schedule={schedule} />
        </div>
        <div className="xl:col-span-2">
          <LearningActivityChart activity={activity} />
        </div>
      </div>

      {/* Row 3: أحدث الدرجات + الواجبات المطلوبة + إنجازات الشهر */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RecentGrades grades={grades} />
        <PendingAssignments />
        <MonthlyProgress />
      </div>

      {/* Row 4: إعلانات + كورساتي */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Announcements announcements={announcements} />
        </div>
        <div className="xl:col-span-2">
          <MyCourses courses={enrolledCourses} />
        </div>
      </div>
    </div>
  )
}
