'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { DonutChart } from '@/components/ui/donut-chart'

export function ExamPerformanceAnalysis({
  data,
}: {
  data?: { 
    average_score: number; 
    total_passed: number; 
    total_failed: number;
    hardest_questions?: { text: string; wrong_answers: number; total_answers: number }[]
  }
}) {
  const avg = Number(data?.average_score || 0)
  const passed = Number(data?.total_passed || 0)
  const failed = Number(data?.total_failed || 0)
  const hardest = data?.hardest_questions || []
  const total = passed + failed

  return (
    <PanelCard title="تحليل أداء الامتحانات">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h4 className="text-sm text-muted-foreground font-medium mb-1">متوسط الدرجات</h4>
            <div className="text-3xl font-bold text-foreground">
              {avg.toFixed(1)} درجة
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h4 className="text-sm text-muted-foreground font-medium mb-1">الناجحين</h4>
              <div className="text-xl font-bold text-emerald-600">
                {passed.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h4 className="text-sm text-muted-foreground font-medium mb-1">الراسبين</h4>
              <div className="text-xl font-bold text-red-600">
                {failed.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          {total > 0 ? (
            <DonutChart
              data={[
                { label: 'ناجح', value: passed, color: 'var(--chart-2)' },
                { label: 'راسب', value: failed, color: 'var(--chart-5)' },
              ]}
              size={180}
              strokeWidth={24}
              centerContent={
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="fill-foreground text-2xl font-bold">
                    {Math.round((passed / total) * 100)}%
                  </span>
                  <span className="fill-muted-foreground text-xs">
                    نسبة النجاح
                  </span>
                </div>
              }
            />
          ) : (
            <div className="text-sm text-muted-foreground">لا توجد امتحانات مصححة بعد</div>
          )}
        </div>
      </div>

      {hardest.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <h4 className="font-bold text-foreground mb-4">أصعب الأسئلة (الأكثر إجابة خطأ)</h4>
          <div className="space-y-3">
            {hardest.map((q, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-sm">
                <span className="font-medium text-foreground line-clamp-2">{q.text}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-red-500 font-bold">{q.wrong_answers} إجابات خاطئة</span>
                  <span>من أصل {q.total_answers} إجابة</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  )
}
