import { ReportsPageHeader } from '@/components/reports/reports-page-header'
import { ReportsStats } from '@/components/reports/reports-stats'
import { RevenueReportChart } from '@/components/reports/revenue-report-chart'
import { StudentsGrowthChart } from '@/components/reports/students-growth-chart'
import { CategoryDistributionChart } from '@/components/reports/category-distribution-chart'
import { PaymentStatusChart } from '@/components/reports/payment-status-chart'
import { RevenueByCategoryChart } from '@/components/reports/revenue-by-category-chart'
import { CoursePerformanceTable } from '@/components/reports/course-performance-table'
import { ReportsHistoryTable } from '@/components/reports/reports-history-table'
import { ConversionFunnelChart } from '@/components/reports/conversion-funnel-chart'
import { TopStudentsTable } from '@/components/reports/top-students-table'
import { ViewsAnalyticsWidget } from '@/components/reports/views-analytics-widget'
import { ExamAnalyticsWidget } from '@/components/reports/exam-analytics-widget'
import { PeriodComparisonWidget } from '@/components/reports/period-comparison-widget'
import { getReports, getReportsData } from './actions'

export default async function ReportsPage() {
  const reports = await getReports()
  const data = await getReportsData()

  if ('error' in data) return <div>{data.error}</div>

  return (
    <div className="space-y-6">
      <ReportsPageHeader />
      <ReportsStats stats={data.reportStats} />

      {/* مقارنة الشهر الحالي بالسابق */}
      <PeriodComparisonWidget data={data.periodComparison} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueReportChart data={data.monthlyRevenue} />
        <StudentsGrowthChart data={data.studentsGrowth} />
      </div>

      {/* قمع التحويل + أكثر الطلاب نشاطاً */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionFunnelChart data={data.conversionFunnel} />
        <TopStudentsTable students={data.topStudents} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueByCategoryChart data={data.revenueByCategory} />
        <PaymentStatusChart data={data.paymentStatus} />
      </div>

      {/* المشاهدات اليومية + توزيع الأجهزة */}
      <ViewsAnalyticsWidget
        dailyViews={data.dailyViews}
        deviceBreakdown={data.deviceBreakdown}
      />

      {/* تحليل أداء الامتحانات + توزيع الدرجات */}
      <ExamAnalyticsWidget
        avg={data.examAvg}
        passed={data.examPassed}
        failed={data.examFailed}
        scoreRanges={data.scoreRanges}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CategoryDistributionChart data={data.categoryDistribution} />
        </div>
        <div className="lg:col-span-2">
          <CoursePerformanceTable courses={data.coursePerformance} />
        </div>
      </div>

      <ReportsHistoryTable reports={reports} />
    </div>
  )
}
