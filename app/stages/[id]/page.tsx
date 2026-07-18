import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStageBySlug } from '@/lib/curriculum'
import { buildStageDescription, getSiteUrl } from '@/lib/seo'
import { JsonLd } from '@/components/seo/json-ld'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { SiteFooter } from '@/components/landing/site-footer'
import { StageDetail } from '@/components/stages/stage-detail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const stage = await getStageBySlug(id)
  if (!stage) return { title: 'المرحلة غير موجودة' }
  const description = buildStageDescription({
    stageTitle: stage.title,
    subtitle: stage.subtitle,
    branchCount: stage.branches.length,
  })
  return {
    title: stage.title,
    description,
    alternates: { canonical: `/stages/${id}` },
    openGraph: {
      title: stage.title,
      description,
      url: `/stages/${id}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: stage.title, description },
  }
}

export default async function StagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const paramsObj = await params
  const id = decodeURIComponent(paramsObj.id)
  const stage = await getStageBySlug(id)
  if (!stage) notFound()

  const siteUrl = getSiteUrl()
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: stage.title, item: `${siteUrl}/stages/${id}` },
    ],
  }

  return (
    <>
      <JsonLd data={breadcrumb} />
      <LandingNavbar />
      <StageDetail stage={stage} />
      <SiteFooter />
    </>
  )
}
