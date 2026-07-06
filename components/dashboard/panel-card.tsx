'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'

export type FilterOption = { label: string; value: string }

export function PanelCard({
  title,
  filter,
  filterOptions,
  filterValue,
  onFilterChange,
  action,
  actionHref,
  actionSlot,
  children,
}: {
  title: string
  /** Static contextual label (e.g. "هذا الأسبوع"). Rendered as a plain chip. */
  filter?: string
  /** When provided, renders a working dropdown instead of a static label. */
  filterOptions?: FilterOption[]
  filterValue?: string
  onFilterChange?: (value: string) => void
  action?: string
  /** If provided, the action button becomes a link. */
  actionHref?: string
  /** Custom header control (takes priority over `action`). */
  actionSlot?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="ns-card flex h-full flex-col gap-0 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {filterOptions && filterOptions.length > 0 ? (
          <FilterDropdown
            options={filterOptions}
            value={filterValue ?? filterOptions[0].value}
            onChange={onFilterChange}
          />
        ) : filter ? (
          <span className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {filter}
          </span>
        ) : null}
        {actionSlot
          ? actionSlot
          : action && (
              actionHref ? (
                <Link href={actionHref} className="text-xs font-semibold text-primary hover:underline">
                  {action}
                </Link>
              ) : (
                <button type="button" className="text-xs font-semibold text-primary hover:underline">
                  {action}
                </button>
              )
            )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Card>
  )
}

function FilterDropdown({
  options,
  value,
  onChange,
}: {
  options: FilterOption[]
  value: string
  onChange?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
      >
        {current.label}
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-20 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          {options.map((o) => {
            const selected = o.value === value
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange?.(o.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-xs font-medium transition-colors hover:bg-secondary ${
                    selected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {o.label}
                  {selected && <Check className="size-3.5" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
