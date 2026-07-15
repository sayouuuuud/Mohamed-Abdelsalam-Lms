'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  type AdminStage,
  type AdminBranch,
  type AdminMonthlyCourse,
  type AdminTerm,
  type StageInput,
  type BranchInput,
  type MonthlyCourseInput,
  type TermInput,
  createStage,
  updateStage,
  deleteStage,
  createBranch,
  updateBranch,
  deleteBranch,
  createMonthlyCourse,
  updateMonthlyCourse,
  deleteMonthlyCourse,
  createTerm,
  updateTerm,
  deleteTerm,
} from '@/app/admin/categories/actions'

type CurriculumContextValue = {
  stages: AdminStage[]
  // stage actions
  openCreateStage: () => void
  openEditStage: (stage: AdminStage) => void
  requestDeleteStage: (stage: AdminStage) => void
  // branch actions
  openCreateBranch: (stageId: string) => void
  openEditBranch: (stageId: string, branch: AdminBranch) => void
  requestDeleteBranch: (branch: AdminBranch) => void
  // course actions
  openCreateCourse: (branchId?: string) => void
  openEditCourse: (course: AdminMonthlyCourse) => void
  requestDeleteCourse: (course: AdminMonthlyCourse) => void
  // term actions
  openCreateTerm: (stageId: string) => void
  openEditTerm: (term: AdminTerm) => void
  requestDeleteTerm: (term: AdminTerm) => void
  // stage modal state
  stageFormOpen: boolean
  editingStage: AdminStage | null
  closeStageForm: () => void
  submitStageForm: (values: StageInput) => void
  deletingStage: AdminStage | null
  closeDeleteStage: () => void
  confirmDeleteStage: () => void
  // branch modal state
  branchFormOpen: boolean
  editingBranch: AdminBranch | null
  branchStageId: string | null
  closeBranchForm: () => void
  submitBranchForm: (values: Omit<BranchInput, 'stageId'>) => void
  deletingBranch: AdminBranch | null
  closeDeleteBranch: () => void
  confirmDeleteBranch: () => void
  // course modal state
  courseFormOpen: boolean
  editingCourse: AdminMonthlyCourse | null
  courseBranchId: string | null
  closeCourseForm: () => void
  submitCourseForm: (values: Omit<MonthlyCourseInput, 'branchId'> & { branchId?: string }) => void
  deletingCourse: AdminMonthlyCourse | null
  closeDeleteCourse: () => void
  confirmDeleteCourse: () => void
  // term modal state
  termFormOpen: boolean
  editingTerm: AdminTerm | null
  termStageId: string | null
  closeTermForm: () => void
  submitTermForm: (values: Omit<TermInput, 'stageId'>) => void
  deletingTerm: AdminTerm | null
  closeDeleteTerm: () => void
  confirmDeleteTerm: () => void
}

const CurriculumContext = createContext<CurriculumContextValue | null>(null)

export function useCurriculum() {
  const ctx = useContext(CurriculumContext)
  if (!ctx) throw new Error('useCurriculum must be used within CurriculumProvider')
  return ctx
}

export function CurriculumProvider({
  children,
  initialStages,
}: {
  children: ReactNode
  initialStages: AdminStage[]
}) {
  const router = useRouter()
  const [stageFormOpen, setStageFormOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<AdminStage | null>(null)
  const [deletingStage, setDeletingStage] = useState<AdminStage | null>(null)

  const [branchFormOpen, setBranchFormOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<AdminBranch | null>(null)
  const [branchStageId, setBranchStageId] = useState<string | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<AdminBranch | null>(null)

  const [courseFormOpen, setCourseFormOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<AdminMonthlyCourse | null>(null)
  const [courseBranchId, setCourseBranchId] = useState<string | null>(null)
  const [deletingCourse, setDeletingCourse] = useState<AdminMonthlyCourse | null>(null)

  const [termFormOpen, setTermFormOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AdminTerm | null>(null)
  const [termStageId, setTermStageId] = useState<string | null>(null)
  const [deletingTerm, setDeletingTerm] = useState<AdminTerm | null>(null)

  const value = useMemo<CurriculumContextValue>(
    () => ({
      stages: initialStages,
      openCreateStage: () => {
        setEditingStage(null)
        setStageFormOpen(true)
      },
      openEditStage: (stage) => {
        setEditingStage(stage)
        setStageFormOpen(true)
      },
      requestDeleteStage: (stage) => setDeletingStage(stage),
      openCreateBranch: (stageId) => {
        setEditingBranch(null)
        setBranchStageId(stageId)
        setBranchFormOpen(true)
      },
      openEditBranch: (stageId, branch) => {
        setEditingBranch(branch)
        setBranchStageId(stageId)
        setBranchFormOpen(true)
      },
      requestDeleteBranch: (branch) => setDeletingBranch(branch),
      openCreateCourse: (branchId) => {
        setEditingCourse(null)
        setCourseBranchId(branchId ?? null)
        setCourseFormOpen(true)
      },
      openEditCourse: (course) => {
        setEditingCourse(course)
        setCourseBranchId(course.branchId)
        setCourseFormOpen(true)
      },
      requestDeleteCourse: (course) => setDeletingCourse(course),

      // term actions
      openCreateTerm: (stageId) => {
        setEditingTerm(null)
        setTermStageId(stageId)
        setTermFormOpen(true)
      },
      openEditTerm: (term) => {
        setEditingTerm(term)
        setTermStageId(term.stageId)
        setTermFormOpen(true)
      },
      requestDeleteTerm: (term) => setDeletingTerm(term),

      stageFormOpen,
      editingStage,
      closeStageForm: () => setStageFormOpen(false),
      submitStageForm: async (values) => {
        const isEdit = !!editingStage
        const id = editingStage?.id
        setStageFormOpen(false)
        setEditingStage(null)
        const res = isEdit
          ? await updateStage(id!, values)
          : await createStage(values)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success(isEdit ? 'تم تحديث المرحلة' : 'تمت إضافة المرحلة')
          router.refresh()
        }
      },
      deletingStage,
      closeDeleteStage: () => setDeletingStage(null),
      confirmDeleteStage: async () => {
        if (!deletingStage) return
        const id = deletingStage.id
        setDeletingStage(null)
        const res = await deleteStage(id)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('تم حذف المرحلة')
          router.refresh()
        }
      },

      branchFormOpen,
      editingBranch,
      branchStageId,
      closeBranchForm: () => setBranchFormOpen(false),
      submitBranchForm: async (values) => {
        const isEdit = !!editingBranch
        const id = editingBranch?.id
        const stageId = branchStageId
        setBranchFormOpen(false)
        setEditingBranch(null)
        const res = isEdit
          ? await updateBranch(id!, values)
          : await createBranch({ ...values, stageId: stageId! })
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success(isEdit ? 'تم تحديث الفرع' : 'تمت إضافة الفرع')
          router.refresh()
        }
      },
      deletingBranch,
      closeDeleteBranch: () => setDeletingBranch(null),
      confirmDeleteBranch: async () => {
        if (!deletingBranch) return
        const id = deletingBranch.id
        setDeletingBranch(null)
        const res = await deleteBranch(id)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('تم حذف الفرع')
          router.refresh()
        }
      },

      courseFormOpen,
      editingCourse,
      courseBranchId,
      closeCourseForm: () => setCourseFormOpen(false),
      submitCourseForm: async (values) => {
        const isEdit = !!editingCourse
        const id = editingCourse?.id
        const branchId = values.branchId || courseBranchId
        setCourseFormOpen(false)
        setEditingCourse(null)
        const res = isEdit
          ? await updateMonthlyCourse(id!, values)
          : await createMonthlyCourse({ ...values, branchId: branchId! })
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success(isEdit ? 'تم تحديث الكورس' : 'تمت إضافة الكورس')
          router.refresh()
        }
      },
      deletingCourse,
      closeDeleteCourse: () => setDeletingCourse(null),
      confirmDeleteCourse: async () => {
        if (!deletingCourse) return
        const id = deletingCourse.id
        setDeletingCourse(null)
        const res = await deleteMonthlyCourse(id)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('تم حذف الكورس')
          router.refresh()
        }
      },

      termFormOpen,
      editingTerm,
      termStageId,
      closeTermForm: () => setTermFormOpen(false),
      submitTermForm: async (values) => {
        const isEdit = !!editingTerm
        const id = editingTerm?.id
        const stageId = termStageId
        setTermFormOpen(false)
        setEditingTerm(null)
        const res = isEdit
          ? await updateTerm(id!, values)
          : await createTerm({ ...values, stageId: stageId! })
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success(isEdit ? 'تم تحديث الترم' : 'تمت إضافة الترم')
          router.refresh()
        }
      },
      deletingTerm,
      closeDeleteTerm: () => setDeletingTerm(null),
      confirmDeleteTerm: async () => {
        if (!deletingTerm) return
        const id = deletingTerm.id
        setDeletingTerm(null)
        const res = await deleteTerm(id)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success('تم حذف الترم')
          router.refresh()
        }
      },
    }),
    [
      initialStages,
      stageFormOpen,
      editingStage,
      deletingStage,
      branchFormOpen,
      editingBranch,
      branchStageId,
      deletingBranch,
      courseFormOpen,
      editingCourse,
      courseBranchId,
      deletingCourse,
      termFormOpen,
      editingTerm,
      termStageId,
      deletingTerm,
      router,
    ],
  )

  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  )
}
