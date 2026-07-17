import 'server-only'
import { prisma } from '@/lib/prisma'

// Shape of the platform-wide settings stored under settings.key = 'global'.
// Only the keys we actually read in server code are typed; the admin panel
// stores a superset.
export type GlobalSettings = {
  security?: {
    twoFactor?: boolean
    // When false, new student signups are auto-confirmed and skip the
    // email activation-code step entirely.
    requireEmailVerification?: boolean
    // When false, new student registration is closed entirely.
    allowRegistrations?: boolean
  }
  [key: string]: any
}

// Reads the global settings object using the service-role client so it works
// from unauthenticated contexts (e.g. the public /auth/register route) where
// RLS would otherwise hide the admin-only settings row.
export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const data = await prisma.settings.findUnique({
      where: { key: 'global' },
      select: { value: true }
    })
    return (data?.value as GlobalSettings) ?? {}
  } catch {
    return {}
  }
}

// Convenience helper: is email verification required for new student signups?
// Defaults to TRUE (verification on) when the setting is missing.
export async function isEmailVerificationRequired(): Promise<boolean> {
  const settings = await getGlobalSettings()
  return settings.security?.requireEmailVerification !== false
}

// Convenience helper: are new student registrations currently allowed?
// Defaults to TRUE (open) when the setting is missing.
export async function areRegistrationsAllowed(): Promise<boolean> {
  const settings = await getGlobalSettings()
  return settings.security?.allowRegistrations !== false
}
