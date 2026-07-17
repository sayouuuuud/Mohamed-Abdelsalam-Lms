'use client'

import { useRef, useState } from 'react'
import { FileText, FileImage, File as FileIcon, X, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getAttachmentUploadUrl } from '@/app/admin/courses/actions'
import { cn } from '@/lib/utils'
import type { LessonAttachment } from '@/app/admin/courses/actions'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

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
// UploadThing storage and keeps a list of {name, url, type} entries.
// Note: lessonAttachment route uses awaitServerData: false so startUpload resolves
// immediately after the S3 upload, without waiting for UploadThing's external webhook.
export function AttachmentsUploadField({
  value,
  onChange,
  label = '',
  hint,
}: {
  value: LessonAttachment[]
  onChange: (attachments: LessonAttachment[]) => void
  label?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const pendingRef = useRef<{ name: string; type: LessonAttachment['type'] }[]>([])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const valid: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" أكبر من 100 ميجابايت`)
        continue
      }
      valid.push(file)
    }

    if (valid.length === 0) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setIsUploading(true)
    const uploaded: LessonAttachment[] = []

    try {
      for (const file of valid) {
        const { uploadUrl, key, error } = await getAttachmentUploadUrl(file.name, file.type)
        
        if (error || !uploadUrl || !key) {
          toast.error(`فشل في جلب رابط الرفع للملف: ${file.name}`)
          continue
        }

        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (!res.ok) {
          toast.error(`فشل الرفع للملف: ${file.name}`)
          continue
        }

        uploaded.push({
          name: file.name,
          url: `/api/${key}`, // Maps to /api/attachments/...
          type: attachmentType(file),
        })
      }

      if (uploaded.length > 0) {
        onChange([...value, ...uploaded])
        toast.success(uploaded.length === 1 ? 'تم رفع الملف بنجاح' : `تم رفع ${uploaded.length} ملفات بنجاح`)
      }
    } catch (e) {
      toast.error(`فشل الرفع: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
    } finally {
      setIsUploading(false)
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
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center transition-colors hover:bg-secondary/60',
          isUploading && 'cursor-not-allowed opacity-70',
        )}
      >
        {isUploading ? (
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
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </>
        )}
      </button>
    </div>
  )
}
