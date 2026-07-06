'use client'

import { UserPlus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudents } from './students-context'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function StudentsPageHeader() {
  const { openCreate, exportData } = useStudents()
  const canManage = useCanManage('students')

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">الطلاب</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          إدارة ومتابعة جميع الطلاب المسجلين في المنصة
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-border bg-card text-foreground hover:bg-secondary"
          onClick={exportData}
        >
          <Download className="size-4" />
          تصدير البيانات
        </Button>
        {canManage && (
          <Button onClick={openCreate}>
            <UserPlus className="size-4" />
            إضافة طالب
          </Button>
        )}
      </div>
    </div>
  )
}
