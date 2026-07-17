import { notFound } from 'next/navigation'
import { getLectureDetailAdmin } from '../actions'
import { getStreamingSettings } from '@/lib/video-actions'
import { AdminLectureDetail } from '@/components/courses/admin-lecture-detail'

export const dynamic = 'force-dynamic'

export default async function AdminLecturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, settings] = await Promise.all([
    getLectureDetailAdmin(id),
    getStreamingSettings(),
  ])
  if (!data) notFound()

  return <AdminLectureDetail lecture={data.lecture} content={data.content} streamingEnabled={settings?.enabled ?? false} />
}
