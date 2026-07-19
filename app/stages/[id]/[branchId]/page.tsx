import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getBranchBySlug } from '@/lib/curriculum'
import { getSiteContent } from '@/lib/site-content'
import { buildBranchDescription, getSiteUrl } from '@/lib/seo'
import { JsonLd } from '@/components/seo/json-ld'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/landing/site-footer'
import { BranchDetail } from '@/components/stages/branch-detail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; branchId: string }>
}): Promise<Metadata> {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const branchId = decodeURIComponent(paramsObj.branchId)
  const [result, { seo }] = await Promise.all([getBranchBySlug(id, branchId), getSiteContent()])
  if (!result) return { title: 'الفرع غير موجود' }
  const description = buildBranchDescription({
    branchTitle: result.branch.title,
    stageTitle: result.stage.title,
    description: result.branch.description,
    lectureCount: result.branch.lectures.length,
    siteName: seo.title,
  })
  return {
    title: result.branch.title,
    description,
    alternates: { canonical: `/stages/${id}/${branchId}` },
    openGraph: {
      title: result.branch.title,
      description,
      url: `/stages/${id}/${branchId}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: result.branch.title, description },
  }
}

export default async function BranchPage({
  params,
}: {
  params: Promise<{ id: string; branchId: string }>
}) {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const branchId = decodeURIComponent(paramsObj.branchId)
  const result = await getBranchBySlug(id, branchId)
  if (!result) notFound()

  const siteUrl = getSiteUrl()
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: result.stage.title, item: `${siteUrl}/stages/${id}` },
      { '@type': 'ListItem', position: 3, name: result.branch.title, item: `${siteUrl}/stages/${id}/${branchId}` },
    ],
  }

  return (
    <>
      <JsonLd data={breadcrumb} />
      <LandingNavbar />
      <BranchDetail stage={result.stage} branch={result.branch} />
      <SiteFooter />
    </>
  )
}
