'use server'

/**
 * lib/media-migrate.ts
 *
 * Migration action: scans all Supabase Storage image URLs in the DB
 * and re-uploads them to UploadThing, then updates the DB row.
 *
 * Tables / columns scanned:
 *   stages.image, branches.image, monthly_courses.image,
 *   lectures.image, lessons.video_url (MP4 direct), profiles.avatar_url
 *
 * Only supabase.co/storage URLs are touched — utfs.io / ufs.sh URLs are skipped.
 */

import { UTApi } from 'uploadthing/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const utapi = new UTApi()

// ── helpers ───────────────────────────────────────────────────────────────────

function isSupabaseStorageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.includes('supabase.co/storage')
}

async function fetchAndReupload(
  sourceUrl: string,
  fileName: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
    const result = await utapi.uploadFiles(file)
    return result.data?.url ?? null
  } catch {
    return null
  }
}

// ── types ─────────────────────────────────────────────────────────────────────

export type MigrationProgress = {
  total:     number
  migrated:  number
  skipped:   number
  failed:    number
  done:      boolean
  log:       string[]
}

export type MigrationDryRunResult = {
  total:   number
  tables:  { table: string; column: string; count: number }[]
}

// ── dry run: count migrateable rows ──────────────────────────────────────────

export async function migrateStorageDryRun(): Promise<MigrationDryRunResult> {
  const supabase = getSupabaseAdmin()

  const targets: { table: string; column: string }[] = [
    { table: 'stages',         column: 'image' },
    { table: 'branches',       column: 'image' },
    { table: 'monthly_courses',column: 'image' },
    { table: 'lectures',       column: 'image' },
    { table: 'lessons',        column: 'video_url' },
    { table: 'profiles',       column: 'avatar_url' },
  ]

  const tables: MigrationDryRunResult['tables'] = []
  let total = 0

  for (const { table, column } of targets) {
    const { data } = await supabase
      .from(table)
      .select(`id, ${column}`)
    const rows = (data as { id: string; [k: string]: string | null }[] | null) ?? []
    const count = rows.filter((row) => isSupabaseStorageUrl(row[column])).length
    if (count > 0) tables.push({ table, column, count })
    total += count
  }

  return { total, tables }
}

// ── real migration ────────────────────────────────────────────────────────────

export async function runStorageMigration(): Promise<MigrationProgress> {
  const supabase = getSupabaseAdmin()

  const targets: { table: string; column: string; filePrefix: string }[] = [
    { table: 'stages',          column: 'image',     filePrefix: 'stage' },
    { table: 'branches',        column: 'image',     filePrefix: 'branch' },
    { table: 'monthly_courses', column: 'image',     filePrefix: 'course' },
    { table: 'lectures',        column: 'image',     filePrefix: 'lecture' },
    { table: 'lessons',         column: 'video_url', filePrefix: 'lesson-video' },
    { table: 'profiles',        column: 'avatar_url',filePrefix: 'avatar' },
  ]

  const log: string[] = []
  let migrated = 0
  let skipped  = 0
  let failed   = 0
  let total    = 0

  for (const { table, column, filePrefix } of targets) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)

    if (error) {
      log.push(`[${table}] قراءة فشلت: ${error.message}`)
      continue
    }

    const rows = (data as unknown as { id: string; [k: string]: string | null }[] | null) ?? []
    const toMigrate = rows.filter((r) => isSupabaseStorageUrl(r[column]))
    total += toMigrate.length

    for (const row of toMigrate) {
      const oldUrl = row[column]!
      const ext = oldUrl.split('.').pop()?.split('?')[0] ?? 'bin'
      const fileName = `${filePrefix}-${row.id}.${ext}`

      const newUrl = await fetchAndReupload(oldUrl, fileName)
      if (!newUrl) {
        log.push(`[${table}/${row.id}] فشل إعادة الرفع: ${oldUrl.slice(0, 60)}...`)
        failed++
        continue
      }

      const { error: updateErr } = await supabase
        .from(table)
        .update({ [column]: newUrl })
        .eq('id', row.id)

      if (updateErr) {
        log.push(`[${table}/${row.id}] تحديث DB فشل: ${updateErr.message}`)
        failed++
      } else {
        log.push(`[${table}/${row.id}] نُقل بنجاح`)
        migrated++
      }
    }
  }

  // lessons.attachments — array of { url, name, type }
  {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, attachments')
    for (const lesson of lessons ?? []) {
      const atts = Array.isArray(lesson.attachments) ? lesson.attachments : []
      let changed = false
      const updated = await Promise.all(
        atts.map(async (a: { url?: string; name?: string; type?: string }) => {
          if (!isSupabaseStorageUrl(a.url)) return a
          total++
          const ext = a.url.split('.').pop()?.split('?')[0] ?? 'bin'
          const fileName = `attachment-${lesson.id}-${a.name ?? ext}`
          const newUrl = await fetchAndReupload(a.url, fileName)
          if (!newUrl) {
            log.push(`[lessons/${lesson.id}/attachment] فشل: ${a.url?.slice(0, 50)}...`)
            failed++
            return a
          }
          changed = true
          migrated++
          log.push(`[lessons/${lesson.id}/attachment:${a.name}] نُقل`)
          return { ...a, url: newUrl }
        }),
      )
      if (changed) {
        await supabase
          .from('lessons')
          .update({ attachments: updated })
          .eq('id', lesson.id)
      }
    }
  }

  return { total, migrated, skipped, failed, done: true, log }
}
