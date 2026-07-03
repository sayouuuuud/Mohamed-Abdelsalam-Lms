import { cn } from '@/lib/utils'

/**
 * Small count badge for sidebar nav items.
 * - Expanded: a red pill with the number (99+ cap).
 * - Collapsed: a small dot on the icon corner so the alert stays visible.
 */
export function NavBadge({
  count,
  collapsed,
}: {
  count: number
  collapsed?: boolean
}) {
  if (!count || count < 1) return null

  if (collapsed) {
    return (
      <span
        className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-sidebar"
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5',
        'bg-destructive text-[11px] font-bold leading-none text-destructive-foreground',
      )}
      aria-label={`${count} عنصر جديد`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
