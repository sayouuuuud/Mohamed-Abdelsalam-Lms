import { LandingPage } from '@/components/landing/landing-page'
import { getCurriculum } from '@/lib/curriculum'
import { getSiteContent } from '@/lib/site-content'
import { getSiteUrl } from '@/lib/seo'
import { JsonLd } from '@/components/seo/json-ld'
import { auth } from '@/auth'
export default async function Page() {
  const session = await auth()
  const user = session?.user
  const [stages, siteContent] = await Promise.all([getCurriculum(), getSiteContent()])
  const siteUrl = getSiteUrl()

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: siteContent.seo.title,
    url: siteUrl,
    description: siteContent.seo.description,
    inLanguage: 'ar',
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteContent.seo.title,
    url: siteUrl,
    inLanguage: 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/stages/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <LandingPage stages={stages} isLoggedIn={!!user} siteContent={siteContent} />
    </>
  )
}
