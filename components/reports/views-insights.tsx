'use client'

import { DonutChart } from '@/components/ui/donut-chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { Monitor, Smartphone, Tablet, Globe, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ViewsInsights({
  data,
}: {
  data?: {
    top_pages: { path: string; views: number }[]
    device_distribution: { device: string; value: number }[]
  }
}) {
  const topPages = data?.top_pages || []
  const deviceDist = data?.device_distribution || []
  const totalDevices = deviceDist.reduce((s, d) => s + Number(d.value), 0)

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop':
        return <Monitor className="size-4" />
      case 'mobile':
        return <Smartphone className="size-4" />
      case 'tablet':
        return <Tablet className="size-4" />
      default:
        return <Monitor className="size-4" />
    }
  }

  const getDeviceColor = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop':
        return 'var(--chart-1)'
      case 'mobile':
        return 'var(--chart-2)'
      case 'tablet':
        return 'var(--chart-3)'
      default:
        return 'var(--chart-4)'
    }
  }

  const getDeviceLabel = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop':
        return 'كمبيوتر'
      case 'mobile':
        return 'موبايل'
      case 'tablet':
        return 'تابلت'
      default:
        return 'أخرى'
    }
  }

  return (
    <PanelCard title="تحليل الزيارات والأجهزة">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Top Pages */}
        <div className="flex flex-col">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="size-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground">أكثر الصفحات زيارة</h4>
          </div>
          
          <div className="flex flex-col gap-2">
            {topPages.length > 0 ? (
              topPages.map((page, i) => {
                const maxViews = Math.max(...topPages.map(p => p.views))
                const pct = Math.max(Math.round((page.views / (maxViews || 1)) * 100), 2)
                
                return (
                  <div key={i} className="group relative flex flex-col gap-2 rounded-xl border border-transparent p-3 hover:bg-secondary/50 hover:border-border transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
                          i === 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500" :
                          i === 1 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
                          i === 2 ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-700" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {i + 1}
                        </div>
                        <span className="truncate text-sm font-medium text-foreground max-w-[180px] sm:max-w-[220px]" dir="ltr">
                          {page.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                        <span className="text-sm font-bold">{page.views.toLocaleString()}</span>
                        <Eye className="size-3.5 opacity-70" />
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div 
                        className="h-full rounded-full bg-primary/40 group-hover:bg-primary transition-all duration-700 ease-out" 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                لا توجد زيارات بعد
              </div>
            )}
          </div>
        </div>

        {/* Device Distribution */}
        <div className="flex flex-col">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Monitor className="size-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground">توزيع الأجهزة</h4>
          </div>
          
          {totalDevices > 0 ? (
            <div className="flex flex-col items-center justify-center gap-8 px-4">
              <div className="relative flex items-center justify-center drop-shadow-md transition-transform hover:scale-105 duration-300">
                <DonutChart
                  data={deviceDist.map((d) => ({
                    label: getDeviceLabel(d.device),
                    value: Number(d.value),
                    color: getDeviceColor(d.device),
                  }))}
                  size={160}
                  strokeWidth={20}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold">{totalDevices.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">إجمالي</span>
                </div>
              </div>
              
              <div className="w-full space-y-3">
                {deviceDist.map((d, i) => {
                  const pct = Math.round((Number(d.value) / totalDevices) * 100)
                  return (
                    <div key={i} className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-colors hover:border-border hover:bg-secondary/20">
                      <div 
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50 transition-transform group-hover:scale-110" 
                        style={{ color: getDeviceColor(d.device) }}
                      >
                        {getDeviceIcon(d.device)}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{getDeviceLabel(d.device)}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold">{pct}%</span>
                            <span className="text-[10px] text-muted-foreground">({d.value})</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div 
                            className="h-full rounded-full transition-all duration-700 ease-out" 
                            style={{ width: `${pct}%`, backgroundColor: getDeviceColor(d.device) }} 
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              لا توجد بيانات للأجهزة
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  )
}
