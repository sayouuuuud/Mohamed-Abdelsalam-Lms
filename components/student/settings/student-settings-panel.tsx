'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  User,
  Shield,
  SlidersHorizontal,
  Camera,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ToggleSwitch } from '@/components/settings/toggle-switch'
import { useStudent } from '@/components/student/student-context'
import { useTheme } from '@/components/theme-provider'
import { uploadFiles } from '@/lib/uploadthing'
import { AvatarImage } from '@/components/ui/avatar'
import { updateStudentProfile, updateStudentPreferences, updateStudentPassword } from '@/app/student/actions'
import { colorPresets, applyColorPreset, type PresetId } from '@/lib/color-presets'

// imported from lib/color-presets

const tabs = [
  { id: 'profile', label: 'الملف الشخصي', icon: User },
  { id: 'security', label: 'الأمان', icon: Shield },
  { id: 'preferences', label: 'التفضيلات', icon: SlidersHorizontal },
] as const

type TabId = (typeof tabs)[number]['id']

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-right text-sm font-medium text-foreground">
      {children}
    </label>
  )
}

export function StudentSettingsPanel({ profile: initProfile }: { profile?: any }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const { profile: contextProfile } = useStudent()
  const studentProfile = initProfile || contextProfile || {}
  const nameParts = (studentProfile.name || '').trim().split(/\s+/).filter(Boolean)

  // editable profile fields
  const [firstName, setFirstName] = useState(nameParts[0] ?? '')
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' '))
  const [phone, setPhone] = useState(
    studentProfile.profile?.phone || studentProfile.phone || '',
  )

  // password fields
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    studentProfile.avatarUrl ?? null,
  )
  const [isUploading, setIsUploading] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة لا يجب أن يتجاوز 2 ميجابايت.')
      return
    }
    setIsUploading(true)
    try {
      const resUpload = await uploadFiles('avatarUploader', {
        files: [file],
      })
      if (!resUpload || !resUpload[0]) throw new Error('Upload failed')
      const publicUrl = resUpload[0].url
      setAvatarUrl(publicUrl)
      const res = await updateStudentProfile({
        fullName: `${firstName} ${lastName}`.trim(),
        phone,
        avatarUrl: publicUrl,
      })
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('تم تحديث صورة الحساب')
        router.refresh()
      }
    } catch {
      toast.error('تعذّر رفع الصورة، حاول مرة أخرى.')
    } finally {
      setIsUploading(false)
    }
  }

  function handleProfileSave() {
    const fullName = `${firstName} ${lastName}`.trim()
    startTransition(async () => {
      const res = await updateStudentProfile({ fullName, phone, avatarUrl })
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('تم حفظ التغييرات بنجاح')
        router.refresh()
      }
    })
  }

  function handlePasswordUpdate() {
    if (newPassword.length < 6) {
      toast.error('كلمة المرور لازم تكون 6 أحرف على الأقل.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين.')
      return
    }
    startTransition(async () => {
      const res = await updateStudentPassword(newPassword)
      if (res?.error) {
        toast.error(res.error || 'تعذّر تحديث كلمة المرور. حاول تاني.')
      } else {
        toast.success('تم تحديث كلمة المرور بنجاح')
        setNewPassword('')
        setConfirmPassword('')
      }
    })
  }

  // preferences — dark mode is driven by the shared theme provider so toggling
  // it here actually flips the whole UI (and persists across reloads).
  const { isDark, toggleTheme } = useTheme()
  const darkMode = isDark
  const setDarkMode = (_v: boolean) => toggleTheme()
  const [activeColor, setActiveColor] = useState<PresetId>(
    () => ((studentProfile.profile?.color_preset as PresetId) ||
      (typeof window !== 'undefined'
        ? (localStorage.getItem('color-preset') as PresetId)
        : null)) ?? 'navy',
  )

  function handleColorChange(id: PresetId) {
    setActiveColor(id)
    applyColorPreset(id)
  }

  // Save preferences to DB and fallback to localStorage
  function handlePrefsSave() {
    startTransition(async () => {
      const res = await updateStudentPreferences(activeColor, {})

      if (res?.error) {
        toast.error('حدث خطأ أثناء حفظ التفضيلات')
      } else {
        toast.success('تم حفظ تفضيلاتك بنجاح')
        router.refresh()
      }

      try {
        localStorage.setItem('student-dark-mode', String(darkMode))
      } catch { }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Tabs nav */}
      <div className="rounded-2xl border border-border bg-card p-2">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <tab.icon className="size-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Panel content */}
      <div className="rounded-2xl border border-border bg-card p-6">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="text-right">
              <h3 className="text-lg font-bold text-foreground">الملف الشخصي</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                حدّث معلوماتك الشخصية وصورة الحساب
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="size-20 ring-2 ring-primary/30">
                  {avatarUrl && (
                    <AvatarImage src={avatarUrl} alt={studentProfile.name ?? ''} />
                  )}
                  <AvatarFallback className="bg-primary/15 text-xl font-semibold text-primary">
                    {studentProfile.initials}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className={cn(
                    'absolute -bottom-1 -left-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-opacity',
                    isUploading && 'opacity-50 pointer-events-none',
                  )}
                  aria-label="تغيير الصورة"
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Camera className="size-3.5" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
              </div>
              <div className="text-right">
                <p className="text-base font-semibold text-foreground">
                  {studentProfile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {studentProfile.level}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>الاسم الأول</FieldLabel>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="text-right"
                />
              </div>
              <div>
                <FieldLabel>الاسم الأخير</FieldLabel>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-right"
                />
              </div>
              <div>
                <FieldLabel>البريد الإلكتروني</FieldLabel>
                <Input
                  type="email"
                  value={studentProfile.email ?? ''}
                  readOnly
                  className="text-right opacity-70"
                  dir="ltr"
                />
              </div>
              <div>
                <FieldLabel>رقم الهاتف</FieldLabel>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="text-right"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-start gap-3">
              <Button onClick={handleProfileSave} disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                حفظ التغييرات
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="text-right">
              <h3 className="text-lg font-bold text-foreground">الأمان</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                إدارة كلمة المرور وحماية حسابك
              </p>
            </div>
            <Separator />
            <div className="grid gap-4 sm:max-w-md">
              <div>
                <FieldLabel>كلمة المرور الجديدة</FieldLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <FieldLabel>تأكيد كلمة المرور</FieldLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex justify-start gap-3">
              <Button onClick={handlePasswordUpdate} disabled={isPending}>
                تحديث كلمة المرور
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-2">
            <div className="text-right">
              <h3 className="text-lg font-bold text-foreground">التفضيلات</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                خصّص تجربتك داخل بوابة الطالب
              </p>
            </div>
            <Separator className="my-4" />
            <div className="divide-y divide-border">
              <ToggleSwitch
                checked={darkMode}
                onChange={setDarkMode}
                label="الوضع الليلي"
                description="استخدام السمة الداكنة للواجهة"
              />
            </div>

            {/* Color picker */}
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-3 text-right text-sm font-medium text-foreground">
                لون الموقع
              </p>
              <p className="mb-4 text-right text-xs text-muted-foreground">
                اختر اللون الرئيسي للواجهة وسيتطبق فوراً على السايدبار والأزرار
              </p>
              <div className="flex flex-wrap gap-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleColorChange(preset.id)}
                    title={preset.label}
                    aria-label={preset.label}
                    className={cn(
                      'group relative flex size-10 items-center justify-center rounded-full transition-transform hover:scale-110',
                      activeColor === preset.id &&
                      'ring-2 ring-offset-2 ring-offset-card ring-foreground/30',
                    )}
                    style={{ backgroundColor: preset.swatch }}
                  >
                    {activeColor === preset.id && (
                      <Check className="size-4 text-white drop-shadow" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-right text-xs text-muted-foreground">
                اللون الحالي:{' '}
                <span className="font-semibold text-foreground">
                  {colorPresets.find((p) => p.id === activeColor)?.label}
                </span>
              </p>
            </div>

            <div className="flex justify-start pt-4">
              <Button onClick={handlePrefsSave} disabled={isPending}>حفظ التفضيلات</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
