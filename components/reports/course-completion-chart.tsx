'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  enrolled: { label: 'مسجلين', color: 'var(--chart-4)' },
  completion_rate: { label: 'نسبة الإنجاز (%)', color: 'var(--chart-1)' },
}

export function CourseCompletionChart({
  data,
}: {
  data?: { name: string; enrolled: number; completion_rate: number }[]
}) {
  const chartData = data || []

  return (
    <PanelCard title="معدل إكمال الكورسات">
      <div className="h-[400px] w-full">
        {chartData.length > 0 ? (
          <ChartContainer config={config} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="enrolled" name="مسجلين" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completion_rate" name="نسبة الإنجاز (%)" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
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
