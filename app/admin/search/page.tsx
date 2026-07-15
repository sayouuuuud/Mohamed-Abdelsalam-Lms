import type { Metadata } from 'next'
import { globalAdminSearch } from './actions'
import { SearchResults } from '@/components/admin/search-results'

export const metadata: Metadata = {
  title: 'البحث',
  robots: { index: false, follow: false },
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const results = await globalAdminSearch(q)

  return <SearchResults q={q} results={results} />
}
