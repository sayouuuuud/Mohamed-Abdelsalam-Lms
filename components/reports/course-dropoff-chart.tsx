'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const config = {
  completion_count: { label: 'طالب وصلوا للدرس', color: 'var(--chart-3)' },
}

export function CourseDropoffChart({
  data,
}: {
  data?: { lesson: string; completion_count: number }[]
}) {
  const chartData = data || []

  return (
    <PanelCard title="نقاط الانسحاب (أقل الدروس إكمالاً)">
      <div className="h-[250px] w-full">
        {chartData.length > 0 ? (
          <ChartContainer config={config} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="lesson" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 12 }} 
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis type="number" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completion_count" name="عدد الواصلين" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات دراسة بعد
          </div>
        )}
      </div>
    </PanelCard>
  )
}
