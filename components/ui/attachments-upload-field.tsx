'use client'

import { useRef, useState } from 'react'
import { FileText, FileImage, File as FileIcon, X, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadToStorage } from '@/lib/storage-upload'
import { cn } from '@/lib/utils'
import type { LessonAttachment } from '@/app/admin/courses/actions'

// Infers the LessonAttachment `type` bucket from a file's name/mime so the
// student player can pick the right icon.
function attachmentType(file: File): LessonAttachment['type'] {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/')) return 'image'
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (/\.(docx?|rtf|odt|pptx?|xlsx?)$/.test(name)) return 'doc'
  return 'other'
}

const iconFor = (type: LessonAttachment['type']) =>
  type === 'image' ? FileImage : type === 'other' ? FileIcon : FileText

// Multi-file attachment picker used by the lesson editor. Uploads each file to
// Supabase Storage and keeps a list of {name, url, type} entries.
export function AttachmentsUploadField({
  value,
  onChange,
  label = 'مرفقات الدرس',
  hint,
}: {
  value: LessonAttachment[]
  onChange: (attachments: LessonAttachment[]) => void
  label?: string
  hint?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: LessonAttachment[] = []
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" أكبر من 25 ميجابايت`)
          continue
        }
        const url = await uploadToStorage(file, 'attachments')
        uploaded.push({ name: file.name, url, type: attachmentType(file) })
      }
      if (uploaded.length > 0) {
        onChange([...value, ...uploaded])
        toast.success(uploaded.length === 1 ? 'تم رفع الملف' : `تم رفع ${uploaded.length} ملفات`)
      }
    } catch (e) {
      toast.error(`فشل الرفع: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <label className="block text-right text-sm font-medium text-foreground">
        {label}
      </label>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((att, i) => {
            const Icon = iconFor(att.type)
            return (
              <li
                key={`${att.url}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm"
              >
                <Icon className="size-4 shrink-0 text-primary" />
                <span className="flex-1 truncate font-medium text-foreground">
                  {att.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`إزالة ${att.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.zip,image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center transition-colors hover:bg-secondary/60',
          uploading && 'cursor-not-allowed opacity-70',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">جاري الرفع...</span>
          </>
        ) : (
          <>
            <Upload className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              اختر ملفًا لإرفاقه
            </span>
            <span className="text-xs text-muted-foreground">
              PDF أو Word أو صور (أقل من 25 MB لكل ملف)
            </span>
          </>
        )}
      </button>
      {hint && (
        <p className="text-right text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
