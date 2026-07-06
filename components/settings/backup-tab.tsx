'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Upload, ShieldAlert, FileJson, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { exportSettingsBackup, importSettingsBackup } from '@/app/admin/settings/backup-actions'

export function BackupTab() {
  const router = useRouter()
  const [exporting, startExport] = useTransition()
  const [importing, startImport] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parsed file waiting for the user to confirm the restore.
  const [pendingBackup, setPendingBackup] = useState<{ payload: unknown; fileName: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleExport() {
    startExport(async () => {
      const res = await exportSettingsBackup()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      // Turn the backup object into a downloadable JSON file (client-side).
      const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `lms-settings-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('تم تنزيل النسخة الاحتياطية بنجاح')
    })
  }

  function handleFilePicked(file: File | undefined) {
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('من فضلك اختر ملف JSON صالح.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        setPendingBackup({ payload: parsed, fileName: file.name })
        setConfirmOpen(true)
      } catch {
        toast.error('تعذّرت قراءة الملف. تأكد إنه ملف نسخة احتياطية صالح.')
      }
    }
    reader.onerror = () => toast.error('حدث خطأ أثناء قراءة الملف.')
    reader.readAsText(file)
    // Allow re-selecting the same file later.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleConfirmRestore() {
    if (!pendingBackup) return
    const payload = pendingBackup.payload
    startImport(async () => {
      const res = await importSettingsBackup(payload)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        const { sections, settings, theme } = res.restored
        const parts: string[] = []
        if (settings) parts.push('الإعدادات العامة')
        if (sections > 0) parts.push(`${sections} قسم محتوى`)
        if (theme) parts.push('الثيم')
        toast.success(parts.length ? `تمت الاستعادة: ${parts.join('، ')}` : 'تمت الاستعادة بنجاح')
        router.refresh()
      }
      setPendingBackup(null)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-right text-lg font-semibold text-foreground">النسخ الاحتياطي والاستعادة</h2>
        <p className="mt-1 text-right text-sm text-muted-foreground">
          احفظ نسخة من إعدادات النظام ومحتوى الموقع، واستعدها وقت ما تحتاج. النسخة تشمل الإعدادات العامة، أقسام محتوى
          الموقع، والثيم فقط — من غير بيانات الطلاب أو المحاضرات.
        </p>
      </div>

      {/* Export */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileJson className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">تصدير نسخة احتياطية</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              نزّل ملف JSON يحتوي على كل إعدادات المنصة الحالية. احتفظ بيه في مكان آمن.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            تنزيل النسخة الاحتياطية
          </Button>
        </div>
      </div>

      {/* Restore */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Upload className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">استعادة من نسخة احتياطية</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              ارفع ملف نسخة احتياطية سابقة. الاستعادة بتعمل دمج (تحديث القيم الموجودة وإضافة الناقص) من غير ما تمسح أي
              بيانات حالية.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            الاستعادة هتكتب فوق الإعدادات ومحتوى الموقع الحاليين بالقيم اللي في الملف. يُفضّل تعمل تصدير نسخة احتياطية
            الأول قبل الاستعادة.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFilePicked(e.target.files?.[0])}
        />
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full sm:w-auto"
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            اختيار ملف واستعادة
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setPendingBackup(null)
        }}
        onConfirm={handleConfirmRestore}
        title="تأكيد الاستعادة"
        description={
          pendingBackup
            ? `هيتم استعادة الإعدادات ومحتوى الموقع من الملف «${pendingBackup.fileName}». القيم الحالية هتتحدّث. تحب تكم��ل؟`
            : 'تحب تكمّل الاستعادة؟'
        }
        confirmLabel="استعادة"
        cancelLabel="إلغاء"
      />
    </div>
  )
}
