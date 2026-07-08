import { ReportsPageHeader } from '@/components/reports/reports-page-header'
import { ReportsStats } from '@/components/reports/reports-stats'
import { RevenueReportChart } from '@/components/reports/revenue-report-chart'
import { StudentsGrowthChart } from '@/components/reports/students-growth-chart'
import { CategoryDistributionChart } from '@/components/reports/category-distribution-chart'
import { PaymentStatusChart } from '@/components/reports/payment-status-chart'
import { RevenueByCategoryChart } from '@/components/reports/revenue-by-category-chart'
import { CoursePerformanceTable } from '@/components/reports/course-performance-table'

// Advanced Analytics Components
import { ViewsInsights } from '@/components/reports/views-insights'

import { TopStudentsTable } from '@/components/reports/top-students-table'
import { CourseCompletionChart } from '@/components/reports/course-completion-chart'
import { ExamPerformanceAnalysis } from '@/components/reports/exam-performance-analysis'
import { RefundsAnalysis } from '@/components/reports/refunds-analysis'
import { PeakTimesHeatmap } from '@/components/reports/peak-times-heatmap'
import { CouponPerformanceTable } from '@/components/reports/coupon-performance-table'
import { CourseDropoffChart } from '@/components/reports/course-dropoff-chart'
import { TimeToCompletionStats } from '@/components/reports/time-to-completion-stats'
import { NotificationsEngagement } from '@/components/reports/notifications-engagement'
import { PaymentMethodsTrends } from '@/components/reports/payment-methods-trends'

import { getReportsData, getAdvancedAnalytics } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReportsPage() {
  const data = await getReportsData()
  const advancedData = await getAdvancedAnalytics()

  if ('error' in data) return <div>{data.error}</div>
  if (advancedData && 'error' in advancedData) return <div>{advancedData.error}</div>

  const adv = advancedData.data

  return (
    <div id="reports-content" className="space-y-6">
      <ReportsPageHeader data={data} />
      <ReportsStats stats={data.reportStats} />
      
      {/* Existing Core Reports */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueReportChart data={data.monthlyRevenue} />
        <StudentsGrowthChart data={data.studentsGrowth} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueByCategoryChart data={data.revenueByCategory} />
        <PaymentStatusChart data={data.paymentStatus} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CategoryDistributionChart data={data.categoryDistribution} />
        </div>
        <div className="lg:col-span-2">
          <CoursePerformanceTable courses={data.coursePerformance} />
        </div>
      </div>

      <div className="py-4">
        <h2 className="text-xl font-bold tracking-tight mb-4">تحليلات متقدمة</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ViewsInsights data={adv?.views_data} />
          <ExamPerformanceAnalysis data={adv?.exam_insights} />
        </div>

        <div className="grid gap-6 mt-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TopStudentsTable data={adv?.top_students} />
          </div>
          <div className="lg:col-span-1">
            <NotificationsEngagement data={adv?.notifications_engagement} />
          </div>
        </div>

        <div className="grid gap-6 mt-6 lg:grid-cols-1">
          <RefundsAnalysis data={adv?.refunds_analysis} />
        </div>

        <div className="grid gap-6 mt-6 lg:grid-cols-2">
          <PaymentMethodsTrends data={adv?.payment_trends} />
          <CouponPerformanceTable data={adv?.coupon_performance} />
        </div>

        <div className="grid gap-6 mt-6 lg:grid-cols-2">
          <CourseDropoffChart data={adv?.dropoff_points} />
          <TimeToCompletionStats data={adv?.time_to_completion} />
        </div>

        <div className="mt-6">
          <CourseCompletionChart data={adv?.course_completion} />
        </div>

        <div className="mt-6">
          <PeakTimesHeatmap data={adv?.peak_times} />
        </div>
      </div>
    </div>
  )
}
