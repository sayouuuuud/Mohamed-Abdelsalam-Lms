'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const config = {
  views: { label: 'الزيارات', color: 'var(--chart-2)' },
}

// Helper to format path names nicely
function formatPath(path: string) {
  if (path.includes('/student/courses/')) return 'كورس: ' + path.split('/').pop()
  if (path.includes('/student/exams')) return 'الامتحانات'
  if (path.includes('/student/browse')) return 'تصفح الكورسات'
  if (path.includes('/student')) return 'لوحة تحكم الطالب'
  if (path === '/') return 'الرئيسية'
  return path
}

export function TopPagesChart({
  data,
}: {
  data?: { top_pages?: { path: string; views: number }[] }
}) {
  const chartData = (data?.top_pages || [])
    .map((item) => ({
      name: formatPath(item.path),
      views: item.views,
    }))
    .sort((a, b) => b.views - a.views)

  return (
    <PanelCard title="أكثر الصفحات زيارة">
      <div className="h-[300px] w-full">
        {chartData.length > 0 ? (
          <ChartContainer config={config} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  orientation="right"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="views"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                  name="عدد الزيارات"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            لا يوجد بيانات كافية
          </div>
        )}
      </div>
    </PanelCard>
  )
}
