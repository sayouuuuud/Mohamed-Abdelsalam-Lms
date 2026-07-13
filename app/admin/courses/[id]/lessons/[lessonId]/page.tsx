import { notFound } from 'next/navigation'
import { getLessonDetailAdmin } from '../../../actions'
import { getStreamingSettings } from '@/lib/video-actions'
import { AdminLessonDetail } from '@/components/courses/admin-lesson-detail'

export const dynamic = 'force-dynamic'

export default async function AdminLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>
}) {
  const { lessonId } = await params
  const [data, settings] = await Promise.all([
    getLessonDetailAdmin(lessonId),
    getStreamingSettings(),
  ])
  if (!data) notFound()

  return (
    <AdminLessonDetail
      lesson={data.lesson}
      lectureId={data.lectureId}
      lectureTitle={data.lectureTitle}
      lectureImage={data.lectureImage}
      siblings={data.siblings}
      streamingEnabled={settings?.enabled ?? false}
    />
  )
}
