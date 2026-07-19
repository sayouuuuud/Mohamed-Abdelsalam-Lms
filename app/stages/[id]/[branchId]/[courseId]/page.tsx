import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCourseBySlug } from '@/lib/curriculum'
import { getSiteContent } from '@/lib/site-content'
import { buildCourseDescription, getSiteUrl } from '@/lib/seo'
import { JsonLd } from '@/components/seo/json-ld'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/landing/site-footer'
import { CourseLanding } from '@/components/stages/course-landing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; branchId: string; courseId: string }>
}): Promise<Metadata> {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const branchId = decodeURIComponent(paramsObj.branchId)
  const courseId = decodeURIComponent(paramsObj.courseId)
  const [result, { seo }] = await Promise.all([
    getCourseBySlug(id, branchId, courseId),
    getSiteContent(),
  ])
  if (!result) return { title: 'الكورس غير موجود' }
  const description = buildCourseDescription({
    courseTitle: result.course.title,
    branchTitle: result.branch.title,
    stageTitle: result.stage.title,
    description: result.course.description,
    price: result.course.price,
    siteName: seo.title,
  })
  return {
    title: result.course.title,
    description,
    alternates: { canonical: `/stages/${id}/${branchId}/${courseId}` },
    openGraph: {
      title: result.course.title,
      description,
      url: `/stages/${id}/${branchId}/${courseId}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: result.course.title, description },
  }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string; branchId: string; courseId: string }>
}) {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const branchId = decodeURIComponent(paramsObj.branchId)
  const courseId = decodeURIComponent(paramsObj.courseId)
  const [result, { seo }] = await Promise.all([
    getCourseBySlug(id, branchId, courseId),
    getSiteContent(),
  ])
  if (!result) notFound()

  const siteUrl = getSiteUrl()

  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: result.course.title,
    description: result.course.description || result.course.title,
    provider: {
      '@type': 'EducationalOrganization',
      name: seo.title,
      url: siteUrl,
    },
    inLanguage: 'ar',
    offers: {
      '@type': 'Offer',
      price: String(result.course.price),
      priceCurrency: 'EGP',
      availability: 'https://schema.org/InStock',
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: result.stage.title, item: `${siteUrl}/stages/${id}` },
      { '@type': 'ListItem', position: 3, name: result.branch.title, item: `${siteUrl}/stages/${id}/${branchId}` },
      { '@type': 'ListItem', position: 4, name: result.course.title, item: `${siteUrl}/stages/${id}/${branchId}/${courseId}` },
    ],
  }

  return (
    <>
      <JsonLd data={courseSchema} />
      <JsonLd data={breadcrumb} />
      <LandingNavbar />
      <CourseLanding stage={result.stage} branch={result.branch} course={result.course} />
      <SiteFooter />
    </>
  )
}
