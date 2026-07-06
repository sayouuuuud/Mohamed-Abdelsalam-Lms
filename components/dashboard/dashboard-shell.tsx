import { PageHeader } from './page-header'
import { StatCards } from './stat-cards'
import { AnalyticsKpis } from './analytics-kpis'
import { RevenueChart } from './revenue-chart'
import { StudentsChart } from './students-chart'
import { ViewsChart } from './views-chart'
import { TopCourses } from './top-courses'
import { ActivityChart } from './activity-chart'
import { ExamPerformanceChart } from './exam-performance-chart'
import { PassFailChart } from './pass-fail-chart'
import { ScoreDistributionChart } from './score-distribution-chart'
import { PaymentMethodsChart } from './payment-methods-chart'
import { PaymentStatusChart } from './payment-status-chart'
import { LatestMessages } from './latest-messages'
import { LatestPayments } from './latest-payments'
import { LatestStudents } from './latest-students'
import { LatestLessons } from './latest-lessons'

export function DashboardShell({ data }: { data?: any }) {
  if (!data) return <PageHeader />

  return (
    <div className="space-y-6">
      <PageHeader />

      <StatCards stats={data.stats} />

      {/* KPIs: امتحانات + مدفوعات */}
      <AnalyticsKpis stats={data.examStats} />

      {/* المشاهدات والزيارات — ويدجت بعرض كامل تحت الكاردات */}
      <ViewsChart
        data={data.viewsData}
        totalViews={data.totalViews}
        totalVisitors={data.totalVisitors}
      />

      {/* Row 1: الإيرادات الشهرية (wide) + أكثر المحاضرات + نشاط المنصة */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <RevenueChart data={data.revenueData} />
        </div>
        <div className="xl:col-span-1">
          <TopCourses courses={data.topCourses} />
        </div>
        <div className="xl:col-span-1">
          <ActivityChart data={data.activityData} />
        </div>
      </div>

      {/* Row 2: آخر الرسائل + آخر الطلاب المسجلين + نمو الطلاب (wide) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-1">
          <LatestMessages messages={data.latestMessages} />
        </div>
        <div className="xl:col-span-1">
          <LatestStudents students={data.latestStudents} />
        </div>
        <div className="xl:col-span-2">
          <StudentsChart data={data.studentsData} />
        </div>
      </div>



      {/* Row 5: آخر المدفوعات + آخر المحاضرات */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LatestPayments payments={data.latestPayments} />
        <LatestLessons lessons={data.latestLessons} />
      </div>
    </div>
  )
}
