import { notFound, redirect } from 'next/navigation'
import { LessonPlayer } from '@/components/student/courses/lesson-player'
import { getPurchasedLesson } from '@/lib/student-lectures-data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>
}) {
  const { id: rawId, lessonId: rawLessonId } = await params
  const id = decodeURIComponent(rawId)
  const lessonId = decodeURIComponent(rawLessonId)
  const data = await getPurchasedLesson(id, lessonId)
  if (!data) notFound()

  console.log('--- LESSON RENDER ---');
  console.log('Lesson ID:', data.lesson.lessonId);
  console.log('Attachments:', JSON.stringify(data.lesson.attachments, null, 2));

  // Sequential gating: disabled for lessons to prevent stuck loops.
  // if (data.lesson.locked) redirect(`/student/courses/${id}`)

  return (
    <LessonPlayer
        course={data.course}
        lesson={data.lesson}
        index={data.index}
        all={data.all}
      />
  )
}
