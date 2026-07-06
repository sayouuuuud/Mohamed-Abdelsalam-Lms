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

export function TopStudentsTable({
  data,
}: {
  data?: { id: string; name: string; email: string; courses_count: number; total_spent: number }[]
}) {
  const students = data || []

  return (
    <PanelCard title="أكثر الطلاب نشاطاً وإنفاقاً">
      <div className="overflow-auto max-h-[265px] scrollbar-hide">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطالب</TableHead>
              <TableHead className="text-center">عدد المحاضرات</TableHead>
              <TableHead className="text-right">إجمالي الإنفاق</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{student.name}</span>
                      <span className="text-xs text-muted-foreground">{student.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {student.courses_count}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-bold">
                    {Number(student.total_spent).toLocaleString()} ج.م
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  لا يوجد بيانات
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </PanelCard>
  )
}
