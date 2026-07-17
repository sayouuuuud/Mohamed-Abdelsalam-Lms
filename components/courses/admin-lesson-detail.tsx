'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  CheckCircle2,
  Film,
  Lock,
  Pencil,
  PlayCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, Field } from '@/components/ui/modal'
import { VideoUploadField } from '@/components/ui/video-upload-field'
import { AttachmentsUploadField } from '@/components/ui/attachments-upload-field'
import { VideoPlayer } from '@/components/student/courses/video-player'
import { cn } from '@/lib/utils'
import { type AdminLesson, type LessonAttachment, updateLesson } from '@/app/admin/courses/actions'

const textareaClass =
  'w-full resize-none rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

export function AdminLessonDetail({
  lesson: initialLesson,
  lectureId,
  lectureTitle,
  lectureImage,
  siblings,
  streamingEnabled = false,
}: {
  lesson: AdminLesson
  lectureId: string
  lectureTitle: string
  lectureImage: string | null
  siblings: AdminLesson[]
  streamingEnabled?: boolean
}) {
  const router = useRouter()
  const [lesson, setLesson] = useState(initialLesson)

  const index = siblings.findIndex((l) => l.id === lesson.id)

  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState(lesson.title)
  const [duration, setDuration] = useState(lesson.duration)
  const [isFree, setIsFree] = useState(lesson.isFree)
  const [video, setVideo] = useState(lesson.videoUrl ?? '')
  const [description, setDescription] = useState(lesson.description ?? '')
  const [attachments, setAttachments] = useState<LessonAttachment[]>(lesson.attachments ?? [])

  const openEdit = () => {
    setTitle(lesson.title)
    setDuration(lesson.duration)
    setIsFree(lesson.isFree)
    setVideo(lesson.videoUrl ?? '')
    setDescription(lesson.description ?? '')
    setAttachments(lesson.attachments ?? [])
    setEditOpen(true)
  }

  const [videoType, setVideoType] = useState<'upload' | 'youtube'>(
    lesson.videoUrl && (lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be'))
      ? 'youtube'
      : 'upload'
  )


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const input = {
      title: title.trim(),
      duration: duration.trim(),
      isFree,
      videoUrl: video || null,
      description: description.trim() || null,
      attachments,
    }
    const res = await updateLesson(lesson.id, input)
    if (res.error) return toast.error(res.error)
    setLesson({ ...lesson, ...input })
    toast.success('تم حفظ الدرس')
    setEditOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/courses"
          className="transition-colors hover:text-foreground"
        >
          المحاضرات
        </Link>
        <span>/</span>
        <Link
          href={`/admin/courses/${lectureId}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          {lectureTitle}
        </Link>
        <span>/</span>
        <span className="text-foreground">{lesson.title}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Player + content (mirrors the student view) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-black">
              {lesson.videoUrl ? (
                <VideoPlayer
                  key={lesson.previewUrl ?? lesson.videoUrl}
                  src={lesson.previewUrl ?? lesson.videoUrl}
                  poster={lectureImage ?? undefined}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                  <Film className="size-12" />
                  <p className="text-sm">لا يوجد فيديو لهذا الدرس بعد</p>
                  <Button size="sm" variant="secondary" onClick={openEdit}>
                    إضافة فيديو
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold text-primary">
                  الدرس {index + 1} من {siblings.length}
                </span>
                <h1 className="mt-1 text-xl font-bold text-foreground text-balance">
                  {lesson.title}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{lesson.duration || 'بدون مدة'}</span>
                  {lesson.isFree ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      مجاني
                    </Badge>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Lock className="size-3" /> مدفوع
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={openEdit} className="shrink-0">
                <Pencil className="size-4" />
                تعديل الدرس
              </Button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {lesson.description || 'لا يوجد وصف لهذا الدرس بعد.'}
            </p>
          </Card>
        </div>

        {/* Sibling lessons */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-base font-bold text-foreground">دروس المحاضرة</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{lectureTitle}</p>
          </Card>

          <Card className="p-0">
            <ul className="divide-y divide-border">
              {siblings.map((l, i) => {
                const active = l.id === lesson.id
                return (
                  <li key={l.id}>
                    <Link
                      href={`/admin/courses/${lectureId}/lessons/${l.id}`}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40',
                        active && 'bg-primary/5',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm',
                            active
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-foreground',
                          )}
                        >
                          {l.title}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {l.duration || 'بدون مدة'}
                        </span>
                      </div>
                      {l.videoUrl ? (
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      ) : (
                        <PlayCircle className="size-4 shrink-0 text-muted-foreground/50" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل الدرس"
        description="عدّل محتوى الدرس والفيديو الخاص به"
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="عنوان الدرس">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="المدة (تلقائية من الفيديو)">
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="تتحسب تلقائياً بعد الرفع"
              dir="ltr"
            />
          </Field>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
            <span className="block text-sm font-medium text-foreground">مصدر الفيديو</span>
            <div className="flex gap-2">
              <Button type="button" variant={videoType === 'upload' ? 'default' : 'outline'} onClick={() => setVideoType('upload')} className="flex-1">رفع ملف مباشر</Button>
              <Button type="button" variant={videoType === 'youtube' ? 'default' : 'outline'} onClick={() => setVideoType('youtube')} className="flex-1">رابط يوتيوب</Button>
            </div>
            {videoType === 'upload' ? (
              <VideoUploadField
                value={video}
                onChange={setVideo}
                hint={streamingEnabled ? 'يتم تشفير الفيديو تلقائيا بعد الرفع' : 'ارفع ملف الفيديو. هذا ما سيشاهده الطالب.'}
                streamingEnabled={streamingEnabled}
                lessonId={lesson.id}
                onDurationDetected={setDuration}
              />
            ) : (
              <Field label="رابط يوتيوب">
                <Input
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                />
              </Field>
            )}
          </div>

          <Field label="وصف الدرس">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="نبذة عن محتوى الدرس"
              className={textareaClass}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">درس مجاني (متاح للمعاينة)</span>
          </label>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">مرفقات الدرس</span>
            <AttachmentsUploadField
              value={attachments}
              onChange={setAttachments}
              hint="ملفات إضافية (PDF، Word، صور...) يقدر الطالب يحمّلها مع الدرس. الحد الأقصى 100 MB لكل ملف."
            />
          </div>

          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">حفظ التغييرات</Button>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
