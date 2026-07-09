'use client'

import { useEffect, useState } from 'react'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useStudents } from './students-context'
import type { StudentGender, StudentStatus } from '@/lib/students-data'
import { UserPlus, Mail } from 'lucide-react'

const statuses: StudentStatus[] = ['نشط', 'موقوف']
const genders: StudentGender[] = ['ذكر', 'أنثى']

type Tab = 'direct' | 'invite'

export function StudentFormModal() {
  const {
    formOpen,
    closeForm,
    submitForm,
    stages,
    deleting,
    closeDelete,
    confirmDelete,
  } = useStudents()

  const [tab, setTab] = useState<Tab>('direct')

  // direct add fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<StudentGender>('ذكر')
  const [status, setStatus] = useState<StudentStatus>('نشط')
  const [stageId, setStageId] = useState<string>('')

  // invite field
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    if (formOpen) {
      setTab('direct')
      setName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setGender('ذكر')
      setStatus('نشط')
      setStageId('')
      setInviteEmail('')
    }
  }, [formOpen])

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) return
    submitForm({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      phone: phone.trim(),
      gender,
      status,
      stageId: stageId || null,
    })
  }

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    submitForm({
      name: inviteEmail.trim(),
      email: inviteEmail.trim(),
      phone: '',
      gender: 'ذكر',
      status: 'موقوف',
    })
  }

  return (
    <>
      <Modal
        open={formOpen}
        onClose={closeForm}
        title="إضافة طالب جديد"
        description="اختر طريقة إضافة الطالب للمنصة"
      >
        {/* Tabs */}
        <div className="mb-5 flex gap-2 rounded-xl border border-border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              tab === 'direct'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <UserPlus className="size-4" />
            إضافة مباشرة
          </button>
          <button
            type="button"
            onClick={() => setTab('invite')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              tab === 'invite'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Mail className="size-4" />
            دعوة بالإيميل
          </button>
        </div>

        {/* Direct add form */}
        {tab === 'direct' && (
          <form onSubmit={handleDirectSubmit} className="space-y-4">
            <Field label="الاسم الكامل">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد إبراهيم"
                autoFocus
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                dir="ltr"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                سيستخدمها الطالب لتسجيل الدخول أول مرة، وينصح بتغييرها بعد ذلك.
              </p>
            </Field>
            <Field label="رقم الهاتف">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0100 000 0000"
                dir="ltr"
              />
            </Field>
            <Field label="الجنس">
              <div className="flex gap-2">
                {genders.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={cn(
                      'flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                      gender === g
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                لو الطالب مرفقش صورة، هيتحطله أفاتار تلقائي حسب الجنس.
              </p>
            </Field>
            {stages.length > 0 && (
              <Field label="السنة الدراسية">
                <div className="flex flex-wrap gap-2">
                  {stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setStageId((prev) => (prev === stage.id ? '' : stage.id))}
                      className={cn(
                        'rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                        stageId === stage.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      {stage.title}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  تُستخدم لمقارنة أداء الطالب عبر فروع المادة في سنته.
                </p>
              </Field>
            )}
            <Field label="الحالة">
              <div className="flex gap-2">
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                      status === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex justify-start gap-2 pt-2">
              <Button type="submit">إضافة الطالب</Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                إلغاء
              </Button>
            </div>
          </form>
        )}

        {/* Invite by email form */}
        {tab === 'invite' && (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground leading-relaxed">
              سيصلك بريد إلكتروني يحتوي على رابط تسجيل، يملأ فيه الطالب بياناته
              بنفسه ويختار كلمة مروره.
            </div>
            <Field label="البريد الإلكتروني للطالب">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
                autoFocus
              />
            </Field>
            <div className="flex justify-start gap-2 pt-2">
              <Button type="submit">إرسال الدعوة</Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="حذف الطالب"
        description={`هل أنت متأكد من حذف الطالب "${deleting?.name}"؟`}
      />
    </>
  )
}
