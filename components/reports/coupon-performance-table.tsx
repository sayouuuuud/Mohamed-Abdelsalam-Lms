'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function CouponPerformanceTable({
  data,
}: {
  data?: { code: string; uses: number; revenue_generated: number; total_discount: number }[]
}) {
  const coupons = data || []

  return (
    <PanelCard title="أداء الكوبونات">
      <div className="overflow-auto max-h-[300px] scrollbar-hide">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead className="text-center">عدد الاستخدامات</TableHead>
              <TableHead className="text-center">إجمالي الخصم</TableHead>
              <TableHead className="text-right">الإيراد المحقق</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length > 0 ? (
              coupons.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span className="font-bold text-primary px-2 py-1 bg-primary/10 rounded-md">
                      {c.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {c.uses}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {Number(c.total_discount).toLocaleString()} ج.م
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">
                    {Number(c.revenue_generated).toLocaleString()} ج.م
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  لم يتم استخدام أي كوبونات بعد
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </PanelCard>
  )
}
