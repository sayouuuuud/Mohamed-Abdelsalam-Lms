'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'كمبيوتر',
  mobile: 'موبايل',
  tablet: 'تابلت',
  bot: 'روبوت / زاحف',
  unknown: 'غير معروف',
}

export function DeviceAnalysisChart({
  data,
}: {
  data?: { device_distribution?: { device: string; value: number }[] }
}) {
  const chartData = (data?.device_distribution || [])
    .filter(d => d.value > 0)
    .map(d => ({
      name: DEVICE_LABELS[d.device] || d.device,
      value: d.value,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <PanelCard title="تحليل الأجهزة المستخدمة">
      <div className="h-[300px] w-full">
        {chartData.length > 0 ? (
          <ChartContainer
            config={{}}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات متاحة
          </div>
        )}
      </div>
    </PanelCard>
  )
}
