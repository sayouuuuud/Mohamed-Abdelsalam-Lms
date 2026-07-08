import { createClient } from '@supabase/supabase-js'

// Service-role client for privileged operations (e.g. creating student
// auth accounts from the admin dashboard). NEVER import this in client code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Support both the legacy and current names for the service-role key.
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
