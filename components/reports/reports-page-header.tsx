'use client'

import { Download, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateReport } from '@/app/admin/reports/actions'
import { toast } from 'sonner'
import { useState } from 'react'

export function ReportsPageHeader() {
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    const res = await generateReport()
    setLoading(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('تم طلب إنشاء التقرير بنجاح')
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">التقارير</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرة تحليلية شاملة على أداء المنصة والإيرادات والطلاب
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          تصدير التقرير
        </Button>
      </div>
    </div>
  )
}
