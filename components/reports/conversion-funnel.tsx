'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { motion } from 'framer-motion'
import { Users, UserPlus, ShoppingCart, GraduationCap } from 'lucide-react'

export function ConversionFunnel({
  data,
}: {
  data?: {
    visitors: number
    registered: number
    buyers: number
    completed: number
  }
}) {
  const visitors = Number(data?.visitors || 0)
  const registered = Number(data?.registered || 0)
  const buyers = Number(data?.buyers || 0)
  const completed = Number(data?.completed || 0)

  const steps = [
    { id: 'visitors', label: 'الزوار', value: visitors, icon: <Users className="size-5" />, color: 'bg-blue-500' },
    { id: 'registered', label: 'المسجلين', value: registered, icon: <UserPlus className="size-5" />, color: 'bg-indigo-500' },
    { id: 'buyers', label: 'المشترين', value: buyers, icon: <ShoppingCart className="size-5" />, color: 'bg-purple-500' },
    { id: 'completed', label: 'أكملوا الكورس', value: completed, icon: <GraduationCap className="size-5" />, color: 'bg-green-500' },
  ]

  const maxVal = Math.max(visitors, 1)

  return (
    <PanelCard title="قمع التحويل (Conversion Funnel)">
      <div className="flex flex-col gap-4 py-4">
        {steps.map((step, idx) => {
          const widthPercent = Math.max((step.value / maxVal) * 100, 2)
          const prevStep = idx > 0 ? steps[idx - 1] : null
          const dropoff = prevStep && prevStep.value > 0 ? ((prevStep.value - step.value) / prevStep.value) * 100 : 0

          return (
            <div key={step.id} className="relative flex items-center group">
              <div className="flex w-32 flex-col gap-1 z-10 shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={`flex size-8 items-center justify-center rounded-full text-white ${step.color}`}>
                    {step.icon}
                  </span>
                  {step.label}
                </div>
              </div>

              <div className="flex-1 relative h-10 flex items-center">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.2 }}
                  className={`h-full rounded-r-full ${step.color} opacity-80 flex items-center pr-4 shadow-sm`}
                >
                  <span className="text-white font-bold text-sm drop-shadow-md">
                    {step.value.toLocaleString()}
                  </span>
                </motion.div>
                
                {idx > 0 && dropoff > 0 && (
                  <span className="absolute left-full pr-2 text-xs font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    تسرب -{dropoff.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PanelCard>
  )
}
