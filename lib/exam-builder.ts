import { CircleDot, FileText, Paperclip, type LucideIcon } from 'lucide-react'

export type QuestionType = 'mcq' | 'essay' | 'file'

export type McqOption = {
  id: string
  text: string
}

export type QuestionContentMode = 'text' | 'image'

export type Question = {
  id: string
  type: QuestionType
  /** Whether the prompt is written as text or uploaded as an image */
  contentMode: QuestionContentMode
  text: string
  /** Public URL of the uploaded question image (used when contentMode === 'image') */
  imageUrl: string
  points: number
  /** MCQ */
  options: McqOption[]
  correctOptionId: string | null
  multipleAnswers: boolean
  /** Essay */
  modelAnswer: string
  wordLimit: number | null
  /** File */
  allowedTypes: string[]
  maxFileSizeMb: number
  required: boolean
}

export type ExamMeta = {
  title: string
  course: string
  description: string
  duration: number
  passMark: number
  shuffle: boolean
  stageId: string | null
  branchId: string | null
}

export const questionTypeMeta: Record<
  QuestionType,
  { label: string; description: string; icon: LucideIcon }
> = {
  mcq: {
    label: 'اختيار من متعدد',
    description: 'سؤال بعدة خيارات وإجابة صحيحة واحدة أو أكثر',
    icon: CircleDot,
  },
  essay: {
    label: 'سؤال مقالي',
    description: 'إجابة نصية مفتوحة يكتبها الطالب',
    icon: FileText,
  },
  file: {
    label: 'إرفاق ملف',
    description: 'يرفق الطالب ملفًا أو صورة كإجابة',
    icon: Paperclip,
  },
}

export const fileTypeOptions = [
  { value: 'image', label: 'صور (JPG, PNG)' },
  { value: 'pdf', label: 'ملفات PDF' },
  { value: 'doc', label: 'مستندات Word' },
  { value: 'zip', label: 'ملفات مضغوطة' },
]

let counter = 0
function uid(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function createOption(text = ''): McqOption {
  return { id: uid('opt'), text }
}

export function createQuestion(type: QuestionType): Question {
  const base: Question = {
    id: uid('q'),
    type,
    contentMode: 'text',
    text: '',
    imageUrl: '',
    points: 1,
    options: [],
    correctOptionId: null,
    multipleAnswers: false,
    modelAnswer: '',
    wordLimit: null,
    allowedTypes: ['image'],
    maxFileSizeMb: 10,
    required: true,
  }

  if (type === 'mcq') {
    const opts = [createOption(), createOption()]
    base.options = opts
    base.correctOptionId = opts[0].id
  }

  return base
}
