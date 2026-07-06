'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { UserPlus, Pencil, Trash2, ShieldCheck, Loader2 } from 'lucide-react'
import {
  RESOURCES,
  type AccessLevel,
  type ResourceKey,
} from '@/lib/permissions'
import {
  createAssistant,
  updateAssistantPermissions,
  deleteAssistant,
  type AssistantRecord,
} from '@/app/admin/settings/assistants-actions'

const LEVEL_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: 'none', label: 'ممنوع' },
  { value: 'view', label: 'عرض فقط' },
  { value: 'manage', label: 'تحكم كامل' },
]

function emptyPermissions(): Record<ResourceKey, AccessLevel> {
  return RESOURCES.reduce(
    (acc, r) => {
      acc[r.key] = 'none'
      return acc
    },
    {} as Record<ResourceKey, AccessLevel>,
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function PermissionGrid({
  value,
  onChange,
}: {
  value: Record<ResourceKey, AccessLevel>
  onChange: (key: ResourceKey, level: AccessLevel) => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {RESOURCES.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
        >
          <span className="text-sm font-medium text-foreground">{r.label}</span>
          <div className="flex gap-1">
            {LEVEL_OPTIONS.map((opt) => {
              const active = value[r.key] === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(r.key, opt.value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? opt.value === 'manage'
                        ? 'bg-primary text-primary-foreground'
                        : opt.value === 'view'
                          ? 'bg-secondary text-secondary-foreground ring-1 ring-primary/40'
                          : 'bg-muted text-muted-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AssistantsTab({
  initialAssistants,
}: {
  initialAssistants: AssistantRecord[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AssistantRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AssistantRecord | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState<Record<ResourceKey, AccessLevel>>(
    emptyPermissions(),
  )

  useEffect(() => {
    if (!formOpen) return
    if (editing) {
      setName(editing.name)
      setEmail(editing.email)
      setPassword('')
      const perms = emptyPermissions()
      for (const [k, v] of Object.entries(editing.permissions)) {
        perms[k as ResourceKey] = (v as AccessLevel) ?? 'none'
      }
      setPermissions(perms)
    } else {
      setName('')
      setEmail('')
      setPassword('')
      setPermissions(emptyPermissions())
    }
  }, [formOpen, editing])

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: AssistantRecord) => {
    setEditing(a)
    setFormOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = editing
        ? await updateAssistantPermissions(editing.id, permissions)
        : await createAssistant({ name, email, password, permissions })
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? 'تم تحديث الصلاحيات' : 'تم إضافة المساعد')
      setFormOpen(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deleteAssistant(target.id)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('تم إزالة المساعد')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="text-right">
          <h3 className="text-lg font-bold text-foreground">المساعدون</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف حسابات مساعدة وتحكّم في الصفحات والصلاحيات المتاحة لكل واحد.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0 gap-2">
          <UserPlus className="size-4" />
          إضافة مساعد
        </Button>
      </div>

      {initialAssistants.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            لا يوجد مساعدون بعد. اضغط «إضافة مساعد» للبدء.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialAssistants.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-10">
                  {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} />}
                  <AvatarFallback>{initials(a.name) || '؟'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {a.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:inline">
                  {a.grantedCount} صفحة
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openEdit(a)}
                  aria-label={`تعديل صلاحيات ${a.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeleteTarget(a)}
                  aria-label={`إزالة ${a.name}`}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'تعديل صلاحيات المساعد' : 'إضافة مساعد جديد'}
        description={
          editing
            ? 'حدّد الصفحات ومستوى الصلاحية لكل صفحة.'
            : 'أنشئ حساب مساعد وحدّد صلاحياته على كل صفحة.'
        }
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <>
              <Field label="الاسم">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم المساعد"
                  required
                />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="assistant@example.com"
                  dir="ltr"
                  required
                />
              </Field>
              <Field label="كلمة المرور">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 حروف على الأقل"
                  dir="ltr"
                  required
                />
              </Field>
            </>
          )}

          {editing && (
            <div className="rounded-xl bg-muted/50 p-3 text-right">
              <p className="text-sm font-semibold text-foreground">{editing.name}</p>
              <p className="text-xs text-muted-foreground">{editing.email}</p>
            </div>
          )}

          <div className="text-right">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              الصلاحيات
            </span>
            <PermissionGrid
              value={permissions}
              onChange={(key, level) =>
                setPermissions((prev) => ({ ...prev, [key]: level }))
              }
            />
          </div>

          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'حفظ التغييرات' : 'إضافة المساعد'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="إزالة المساعد"
        description={`هيتم تحويل «${deleteTarget?.name ?? ''}» لحساب طالب عادي وإلغاء كل صلاحياته الإدارية. تقدر ترجّعه مساعد تاني في أي وقت.`}
        confirmLabel="إزالة"
      />
    </div>
  )
}
