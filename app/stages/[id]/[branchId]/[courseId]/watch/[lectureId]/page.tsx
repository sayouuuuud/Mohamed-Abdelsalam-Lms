import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getFreeLectureWatch } from '@/lib/free-lecture-data'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/landing/site-footer'
import { FreeLectureWatch } from '@/components/stages/free-lecture-watch'

type PageProps = {
  params: Promise<{ id: string; branchId: string; courseId: string; lectureId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, branchId, courseId, lectureId } = await params
  const data = await getFreeLectureWatch(id, branchId, courseId, lectureId)
  if (!data) return { title: 'المحاضرة غير متاحة' }
  return { title: `${data.lecture.title} (مجانية) — منصة الأستاذ عبد السلام` }
}

export default async function FreeLectureWatchPage({ params }: PageProps) {
  const { id, branchId, courseId, lectureId } = await params
  const data = await getFreeLectureWatch(id, branchId, courseId, lectureId)
  if (!data) notFound()

  return (
    <>
      <LandingNavbar />
      <FreeLectureWatch data={data} backHref={`/stages/${id}/${branchId}/${courseId}`} />
      <SiteFooter />
    </>
  )
}
