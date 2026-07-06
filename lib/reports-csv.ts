// Builds a single multi-section CSV string from all the data rendered on the
// reports page. Charts themselves can't live in a CSV, but every dataset that
// powers a chart/table/stat is exported here so nothing on the page is lost.

export type ReportsData = {
  reportStats: { label: string; value: number; suffix: string; change: number; up: boolean }[]
  monthlyRevenue: { month: string; revenue: number; target: number }[]
  studentsGrowth: { month: string; students: number }[]
  categoryDistribution: { name: string; value: number }[]
  revenueByCategory: { name: string; revenue: number }[]
  paymentStatus: { name: string; value: number }[]
  coursePerformance: {
    title: string
    category: string
    students: number
    revenue: number
    share: number
  }[]
}

// Escape a single CSV cell: wrap in quotes and double any inner quotes.
function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function row(cells: unknown[]): string {
  return cells.map(cell).join(',')
}

// A titled block of rows, followed by a blank separator line.
function section(title: string, header: string[], rows: unknown[][]): string[] {
  const lines: string[] = []
  lines.push(row([title]))
  lines.push(row(header))
  if (rows.length === 0) {
    lines.push(row(['لا توجد بيانات']))
  } else {
    rows.forEach((r) => lines.push(row(r)))
  }
  lines.push('') // blank line between sections
  return lines
}

export function buildReportsCsv(data: ReportsData): string {
  const lines: string[] = []

  // File title + timestamp.
  lines.push(row(['تقرير المنصة الشامل']))
  lines.push(row(['تاريخ التصدير', new Date().toLocaleString('ar-EG')]))
  lines.push('')

  lines.push(
    ...section(
      'الإحصائيات العامة',
      ['المؤشر', 'القيمة', 'الوحدة', 'نسبة التغيّر %', 'الاتجاه'],
      data.reportStats.map((s) => [
        s.label,
        s.value,
        s.suffix,
        s.change,
        s.up ? 'صاعد' : 'هابط',
      ]),
    ),
  )

  lines.push(
    ...section(
      'الإيرادات الشهرية',
      ['الشهر', 'الإيرادات (ج.م)', 'المستهدف (ج.م)'],
      data.monthlyRevenue.map((m) => [m.month, m.revenue, m.target]),
    ),
  )

  lines.push(
    ...section(
      'نمو الطلاب التراكمي',
      ['الشهر', 'إجمالي الطلاب'],
      data.studentsGrowth.map((g) => [g.month, g.students]),
    ),
  )

  lines.push(
    ...section(
      'الإيرادات حسب التصنيف',
      ['التصنيف', 'الإيرادات (ج.م)'],
      data.revenueByCategory.map((r) => [r.name, r.revenue]),
    ),
  )

  lines.push(
    ...section(
      'حالة المدفوعات',
      ['الحالة', 'العدد'],
      data.paymentStatus.map((p) => [p.name, p.value]),
    ),
  )

  lines.push(
    ...section(
      'توزيع الطلاب حسب التصنيف',
      ['التصنيف', 'عدد الطلاب'],
      data.categoryDistribution.map((c) => [c.name, c.value]),
    ),
  )

  lines.push(
    ...section(
      'أداء الكورسات',
      ['الكورس', 'التصنيف', 'عدد الطلاب', 'الإيرادات (ج.م)', 'النسبة من الإجمالي %'],
      data.coursePerformance.map((c) => [
        c.title,
        c.category,
        c.students,
        c.revenue,
        c.share,
      ]),
    ),
  )

  return lines.join('\r\n')
}

// Trigger a client-side download of the CSV. A UTF-8 BOM is prepended so Excel
// renders the Arabic text correctly.
export function downloadReportsCsv(data: ReportsData): void {
  const csv = buildReportsCsv(data)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `تقرير-المنصة-${today}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
