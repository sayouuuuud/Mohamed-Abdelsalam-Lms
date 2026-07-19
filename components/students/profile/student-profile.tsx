'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Monitor,
  Globe,
  MapPin,
  Wifi,
  ChevronDown,
  BookOpen,
  TrendingUp,
  Wallet,
  Award,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/get-initials'
import { cn } from '@/lib/utils'
import { getStudentAvatar } from '@/lib/students-data'
import type { StudentProfile, StudentStatus } from '@/lib/student-profile-data'
import { updateStudentStatus } from '@/app/admin/students/[id]/actions'
import { MessageModal } from './message-modal'
import { ProfileCharts } from './profile-charts'
import { ProfileTables } from './profile-tables'

const statusOptions: StudentStatus[] = ['نشط', 'موقوف']

const statusStyles: Record<StudentStatus, string> = {
  نشط: 'bg-success/10 text-success',
  موقوف: 'bg-destructive/10 text-destructive',
}

interface StudentProfileViewProps {
  profile: StudentProfile
  studentDbId: string   // students.id (UUID) — needed for DB updates
}

export function StudentProfileView({ profile, studentDbId }: StudentProfileViewProps) {
  const { student, device, presence } = profile
  const [status, setStatus] = useState<StudentStatus>(student.status)
  const [statusOpen, setStatusOpen] = useState(false)

  useEffect(() => {
    setStatus(student.status)
  }, [student.status])
  const [messageOpen, setMessageOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const avgGrade =
    profile.exams.length > 0
      ? Math.round(
          profile.exams.reduce((sum, e) => sum + (e.total > 0 ? (e.score / e.total) * 100 : 0), 0) /
            profile.exams.length,
        )
      : 0

  // Live values computed from real enrollments instead of stale static columns.
  const coursesCount = profile.courses.length
  const avgProgress =
    profile.courses.length > 0
      ? Math.round(
          profile.courses.reduce((sum, c) => sum + c.progress, 0) / profile.courses.length,
        )
      : 0

  const kpis = [
    {
      label: 'الدورات المسجّلة',
      value: String(coursesCount),
      icon: BookOpen,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'متوسط التقدم',
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'إجمالي الإنفاق',
      value: `${profile.totalSpent.toLocaleString()} ج.م`,
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${avgGrade}%`,
      icon: Award,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ]

  const deviceInfo = [
    { label: 'الجهاز', value: device.deviceType, icon: Monitor },
    { label: 'نظام التشغيل', value: device.os, icon: Monitor },
    { label: 'المتصفح', value: device.browser, icon: Globe },
    { label: 'عنوان IP', value: device.ip, icon: Wifi, ltr: true },
    { label: 'الموقع', value: `${device.city}، ${device.country}`, icon: MapPin },
    { label: 'عدد الجلسات', value: String(device.sessions), icon: Calendar },
  ]

  const handleStatusChange = (next: StudentStatus) => {
    setStatusOpen(false)
    const prev = status
    setStatus(next) // optimistic update
    startTransition(async () => {
      try {
        const result = await updateStudentStatus(studentDbId, student.id, next)
        if (result.error) {
          setStatus(prev) // rollback on error
          toast.error(`فشل تغيير الحالة: ${result.error}`)
        } else {
          toast.success(`تم تغيير حالة الطالب إلى "${next}"`)
          router.refresh() // sync server-rendered data with the new status
        }
      } catch {
        setStatus(prev)
        toast.error('فشل تغيير الحالة: تعذر الاتصال بالخادم.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        العودة إلى قائمة الطلاب
      </Link>

      {/* Header card */}
      <Card className="gap-0 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-16">
                <AvatarImage src={getStudentAvatar(student)} alt={student.name} />
                <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                  {getInitials(student.name)}
                </AvatarFallback>
              </Avatar>
              {/* Live presence dot */}
              <span
                className={cn(
                  'absolute bottom-0 left-0 size-4 rounded-full border-2 border-card',
                  presence.isOnline ? 'bg-success' : 'bg-muted-foreground/40',
                )}
                title={presence.isOnline ? 'متصل الآن' : `آخر ظهور: ${presence.lastSeenLabel}`}
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{student.name}</h2>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    statusStyles[status],
                  )}
                >
                  {status}
                </span>
                {/* Online / last-seen badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    presence.isOnline
                      ? 'bg-success/10 text-success'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      presence.isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground/50',
                    )}
                  />
                  {presence.isOnline ? 'متصل الآن' : `آخر ظهور ${presence.lastSeenLabel}`}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{student.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">آخر نشاط: {device.lastActive}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status control */}
            <div className="relative">
              <Button
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-secondary"
                onClick={() => setStatusOpen((v) => !v)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                تغيير الحالة
              </Button>
              {statusOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setStatusOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleStatusChange(opt)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm transition-colors hover:bg-secondary',
                          opt === status ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {opt}
                        {opt === status && <span className="size-2 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              className="border-border bg-card text-foreground hover:bg-secondary"
              onClick={() => {
                window.location.href = `tel:${student.phone.replace(/\s/g, '')}`
              }}
            >
              <Phone className="size-4" />
              اتصال
            </Button>
            <Button onClick={() => setMessageOpen(true)}>
              <MessageSquare className="size-4" />
              مراسلة
            </Button>
          </div>
        </div>

        {/* Contact + device info */}
        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-border pt-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-bold text-foreground">بيانات التواصل</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground" dir="ltr">
                  {student.email}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground" dir="ltr">
                  {student.phone}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Calendar className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">انضم في {student.joinedAt}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-foreground">الجهاز والموقع</h3>
            <ul className="grid grid-cols-2 gap-3 text-sm">
              {deviceInfo.map((info) => (
                <li key={info.label} className="flex items-start gap-2">
                  <info.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{info.label}</p>
                    <p
                      className="truncate font-medium text-foreground"
                      dir={info.ltr ? 'ltr' : undefined}
                    >
                      {info.value}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="gap-0 p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <div className={cn('flex size-10 items-center justify-center rounded-xl', kpi.bg)}>
                <kpi.icon className={cn('size-5', kpi.color)} />
              </div>
            </div>
            <span className="mt-3 block text-2xl font-bold text-foreground">{kpi.value}</span>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <ProfileCharts profile={profile} />

      {/* Tabs: courses / payments / exams / assignments */}
      <ProfileTables profile={profile} />

      <MessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        studentId={studentDbId}
        studentCode={student.id}
        studentName={student.name}
      />
    </div>
  )
}
