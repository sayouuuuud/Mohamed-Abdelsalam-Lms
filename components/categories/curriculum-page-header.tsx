'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurriculum } from './curriculum-context'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function CurriculumPageHeader() {
  const { openCreateStage } = useCurriculum()
  const canManage = useCanManage('categories')

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">التصنيفات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          نظّم التصنيفات الرئيسية والفرعية — وهي نفس البيانات اللي بتظهر للطلاب
        </p>
      </div>

      {canManage && (
        <Button onClick={openCreateStage}>
          <Plus className="size-4" />
          إضافة تصنيف رئيسي
        </Button>
      )}
    </div>
  )
}
