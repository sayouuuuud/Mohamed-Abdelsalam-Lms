import { notFound } from 'next/navigation'
import { CourseOverview } from '@/components/student/courses/course-overview'
import { getPurchasedCourseDetail } from '@/lib/student-lectures-data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const id = decodeURIComponent((await params).id)
  const course = await getPurchasedCourseDetail(id)
  if (!course) notFound()

  return (
    <CourseOverview course={course} />
  )
}
