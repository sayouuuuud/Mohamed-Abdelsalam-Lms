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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rawQ = params.q
  const q = typeof rawQ === 'string' ? rawQ : Array.isArray(rawQ) ? rawQ[0] : ''
  const results = await globalAdminSearch(q)

  return <SearchResults q={q} results={results} />
}
