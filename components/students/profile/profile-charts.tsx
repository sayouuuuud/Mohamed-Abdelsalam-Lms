'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { StudentProfile } from '@/lib/student-profile-data'

const progressConfig: ChartConfig = {
  progress: { label: 'نسبة التقدم', color: 'var(--chart-1)' },
}
const spendConfig: ChartConfig = {
  amount: { label: 'الإنفاق (ج.م)', color: 'var(--chart-2)' },
}
const skillsConfig: ChartConfig = {
  examAvg: { label: 'متوسط الامتحانات', color: 'var(--chart-1)' },
  courseProgress: { label: 'تقدّم المحاضرات', color: 'var(--chart-2)' },
}
const breakdownConfig: ChartConfig = {
  value: { label: 'الواجبات' },
}

const pieColors = ['var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)']

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="text-right">
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

export function ProfileCharts({ profile }: { profile: StudentProfile }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="تطور التعلم" subtitle="نسبة التقدم خلال آخر 6 أشهر">
        <ChartContainer config={progressConfig} className="aspect-[16/7] w-full">
          <AreaChart data={profile.progressTrend} margin={{ left: -16, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-progress)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-progress)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} reversed />
            <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="progress"
              type="monotone"
              stroke="var(--color-progress)"
              strokeWidth={2}
              fill="url(#fillProgress)"
            />
          </AreaChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="الإنفاق الشهري" subtitle="إجمالي المدفوعات حسب الشهر">
        <ChartContainer config={spendConfig} className="aspect-[16/7] w-full">
          <BarChart data={profile.monthlySpend} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} reversed />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="المقارنة بين فروع المادة"
        subtitle={
          profile.stageTitle
            ? `أداء الطالب عبر فروع ${profile.stageTitle}`
            : 'أداء الطالب عبر فروع السنة الدراسية'
        }
      >
        {profile.skills.length > 0 ? (
          <>
            <ChartContainer config={skillsConfig} className="mx-auto aspect-square max-h-[260px]">
              <RadarChart data={profile.skills}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <Radar
                  dataKey="examAvg"
                  fill="var(--color-examAvg)"
                  fillOpacity={0.35}
                  stroke="var(--color-examAvg)"
                  strokeWidth={2}
                />
                <Radar
                  dataKey="courseProgress"
                  fill="var(--color-courseProgress)"
                  fillOpacity={0.2}
                  stroke="var(--color-courseProgress)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--chart-1)' }} />
                متوسط الامتحانات
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--chart-2)' }} />
                تقدّم المحاضرات
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
            لا توجد فروع مرتبطة بالسنة الدراسية لهذا الطالب بعد.
          </div>
        )}
      </ChartCard>

      <ChartCard title="حالة الواجبات" subtitle="توزيع الواجبات المسلّمة والمتأخرة">
        <ChartContainer config={breakdownConfig} className="mx-auto aspect-square max-h-[260px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
            <Pie
              data={profile.assignmentBreakdown}
              dataKey="value"
              nameKey="label"
              innerRadius={55}
              strokeWidth={4}
            >
              {profile.assignmentBreakdown.map((entry, i) => (
                <Cell key={entry.label} fill={pieColors[i % pieColors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
          {profile.assignmentBreakdown.map((entry, i) => (
            <span key={entry.label} className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: pieColors[i % pieColors.length] }}
              />
              {entry.label}: <strong className="text-foreground">{entry.value}</strong>
            </span>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
