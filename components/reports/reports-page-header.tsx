'use client'

import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateReport } from '@/app/admin/reports/actions'
import { downloadReportsCsv, type ReportsData } from '@/lib/reports-csv'
import { toast } from 'sonner'
import { useState } from 'react'

export function ReportsPageHeader({ data }: { data: ReportsData }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      // Build + download the CSV from everything on the page.
      downloadReportsCsv(data)
      toast.success('تم تصدير التقرير بصيغة CSV')
      // Log the export in the reports history (fire-and-forget).
      generateReport().catch(() => {})
    } catch (err) {
      toast.error('حصل خطأ أثناء تصدير التقرير')
    } finally {
      setLoading(false)
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

        <Button onClick={handleExport} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          تصدير التقرير
        </Button>
      </div>
    </div>
  )
}
