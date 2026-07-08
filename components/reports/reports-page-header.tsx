'use client'

import { Download, FileText, Loader2, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { generateReport } from '@/app/admin/reports/actions'
import { downloadReportsCsv, type ReportsData } from '@/lib/reports-csv'
import { exportReportsPdf } from '@/lib/reports-pdf'
import { toast } from 'sonner'
import { useState } from 'react'

export function ReportsPageHeader({ data }: { data: ReportsData }) {
  const [loading, setLoading] = useState(false)

  async function handleExportPdf() {
    setLoading(true)
    const toastId = toast.loading('جاري تجهيز التقرير بالرسوم البيانية...')
    try {
      // Capture the entire reports page (charts included) into a paginated PDF.
      await exportReportsPdf('reports-content')
      toast.success('تم تصدير التقرير بصيغة PDF', { id: toastId })
      // Log the export in the reports history (fire-and-forget).
      generateReport().catch(() => {})
    } catch (err) {
      toast.error('حصل خطأ أثناء تصدير التقرير', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  function handleExportCsv() {
    try {
      downloadReportsCsv(data)
      toast.success('تم تصدير البيانات بصيغة CSV')
      generateReport().catch(() => {})
    } catch (err) {
      toast.error('حصل خطأ أثناء تصدير التقرير')
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

      <div className="flex items-center gap-2" data-export-exclude>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              تصدير التقرير
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPdf} disabled={loading}>
              <FileText className="size-4" />
              <span>PDF كامل بالرسوم البيانية</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCsv} disabled={loading}>
              <Table2 className="size-4" />
              <span>CSV (البيانات فقط)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
