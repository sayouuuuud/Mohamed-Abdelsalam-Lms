import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCourseBySlug } from '@/lib/curriculum'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/landing/site-footer'
import { CourseLanding } from '@/components/stages/course-landing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; branchId: string; courseId: string }>
}): Promise<Metadata> {
  const { id, branchId, courseId } = await params
  const result = await getCourseBySlug(id, branchId, decodeURIComponent(courseId))
  if (!result) return { title: 'الكورس غير موجود' }
  return {
    title: `${result.course.title} — منصة الأستاذ عبد السلام`,
    description: result.course.description,
  }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string; branchId: string; courseId: string }>
}) {
  const { id, branchId, courseId } = await params
  const result = await getCourseBySlug(id, branchId, decodeURIComponent(courseId))
  if (!result) notFound()

  return (
    <>
      <LandingNavbar />
      <CourseLanding stage={result.stage} branch={result.branch} course={result.course} />
      <SiteFooter />
    </>
  )
}
