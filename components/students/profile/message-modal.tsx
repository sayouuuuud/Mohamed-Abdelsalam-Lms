'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Send, Loader2 } from 'lucide-react'
import { Modal, Field } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { sendMessageToStudent } from '@/app/admin/students/[id]/actions'

interface MessageModalProps {
  open: boolean
  onClose: () => void
  studentId: string    // students.id (UUID)
  studentCode: string  // students.code
  studentName: string
}

const channels = ['رسالة داخلية', 'إشعار'] as const

export function MessageModal({ open, onClose, studentId, studentCode, studentName }: MessageModalProps) {
  const [channel, setChannel] = useState<(typeof channels)[number]>('رسالة داخلية')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    if (!body.trim()) {
      toast.error('اكتب نص الرسالة أولاً')
      return
    }
    startTransition(async () => {
      const result = await sendMessageToStudent(
        studentId,
        studentCode,
        studentName,
        subject,
        body,
        channel,
      )
      if (result.error) {
        toast.error(`فشل الإرسال: ${result.error}`)
      } else {
        toast.success(`تم إرسال الرسالة إلى ${studentName}`)
        setSubject('')
        setBody('')
        onClose()
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`مراسلة ${studentName}`}
      description="أرسل رسالة مباشرة إلى الطالب"
    >
      <div className="space-y-4">
        <Field label="قناة الإرسال">
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ' +
                  (channel === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="الموضوع">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="موضوع الرسالة"
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </Field>

        <Field label="نص الرسالة">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="اكتب رسالتك هنا..."
            className="w-full resize-none rounded-xl border border-border bg-secondary/60 p-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </Field>

        <div className="flex justify-start gap-2 pt-1">
          <Button onClick={handleSend} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isPending ? 'جاري الإرسال...' : 'إرسال'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  )
}
