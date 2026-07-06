'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLectures } from './lectures-context'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function LecturesPageHeader() {
  const { openCreateLecture } = useLectures()
  const canManage = useCanManage('courses')

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">المحاضرات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أضف المحاضرات وحدد المرحلة والفرع التابعة له، وأدر دروس كل محاضرة
        </p>
      </div>

      {canManage && (
        <Button onClick={openCreateLecture}>
          <Plus className="size-4" />
          إضافة محاضرة
        </Button>
      )}
    </div>
  )
}
