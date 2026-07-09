'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { exportToCsv } from '@/lib/export-csv'
import {
  type StudentGender,
  type StudentRecord,
  type StudentStatus,
} from '@/lib/students-data'
import { createStudent, deleteStudent, type StageOption } from '@/app/admin/students/actions'

export type StudentFormValues = {
  name: string
  email: string
  password?: string
  phone: string
  gender: StudentGender
  status: StudentStatus
  stageId?: string | null
}

type StudentsContextValue = {
  students: StudentRecord[]
  stages: StageOption[]
  openCreate: () => void
  requestDelete: (student: StudentRecord) => void
  exportData: () => void
  formOpen: boolean
  closeForm: () => void
  submitForm: (values: StudentFormValues) => void
  deleting: StudentRecord | null
  closeDelete: () => void
  confirmDelete: () => void
}

const StudentsContext = createContext<StudentsContextValue | null>(null)

export function useStudents() {
  const ctx = useContext(StudentsContext)
  if (!ctx) throw new Error('useStudents must be used within StudentsProvider')
  return ctx
}

export function StudentsProvider({
  children,
  initialStudents,
  stages,
}: {
  children: ReactNode
  initialStudents: StudentRecord[]
  stages: StageOption[]
}) {
  const router = useRouter()
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<StudentRecord | null>(null)

  useEffect(() => {
    setStudents(initialStudents)
  }, [initialStudents])

  const value = useMemo<StudentsContextValue>(
    () => ({
      students,
      stages,
      openCreate: () => setFormOpen(true),
      requestDelete: (student) => setDeleting(student),
      exportData: () => {
        if (students.length === 0) {
          toast.error('لا توجد بيانات طلاب للتصدير')
          return
        }
        exportToCsv(
          'students.csv',
          students.map((s) => ({
            'رقم الطالب': s.id,
            الاسم: s.name,
            'البريد الإلكتروني': s.email,
            الهاتف: s.phone,
            الجنس: s.gender,
            المحاضرات: s.courses,
            'نسبة التقدم': `${s.progress}%`,
            الإنفاق: s.spent,
            الحالة: s.status,
            'تاريخ الانضمام': s.joinedAt,
          })),
        )
        toast.success('تم تصدير بيانات الطلاب')
      },
      formOpen,
      closeForm: () => setFormOpen(false),
      submitForm: async (values) => {
        setFormOpen(false)
        const result = await createStudent({
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          gender: values.gender,
          status: values.status,
          stageId: values.stageId ?? null,
        })
        if (result?.error) {
          toast.error(result.error)
          return
        }
        toast.success('تم إضافة الطالب بنجاح')
        router.refresh()
      },
      deleting,
      closeDelete: () => setDeleting(null),
      confirmDelete: async () => {
        const target = deleting
        setDeleting(null)
        if (!target) return
        // Optimistic removal for instant feedback.
        setStudents((prev) => prev.filter((s) => s.id !== target.id))
        const result = await deleteStudent(target.id)
        if (result?.error) {
          toast.error(result.error)
          router.refresh()
          return
        }
        toast.success('تم حذف الطالب')
        router.refresh()
      },
    }),
    [students, stages, formOpen, deleting, router],
  )

  return (
    <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
  )
}
