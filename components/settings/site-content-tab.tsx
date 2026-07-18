'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Loader2,
  RotateCcw,
  Camera,
  GripVertical,
  Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { uploadFiles } from '@/lib/uploadthing'
import {
  updateSiteContentSection,
  resetSiteContentSection,
} from '@/app/admin/settings/actions'
import type {
  SiteContent,
  HeroContent,
  FeaturesContent,
  FeatureItem,
  StatsContent,
  StatItem,
  TestimonialsContent,
  TestimonialItem,
  JourneyPoint,
  CtaContent,
  FooterContent,
  FooterLink,
  SocialLink,
  SocialPlatform,
  NavbarContent,
  SeoContent,
  LoginPanelContent,
  LoginPanelStat,
} from '@/lib/site-content-defaults'

// ── Shared primitives ──────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 text-right">
      <label className="block text-sm font-medium text-foreground">{children}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {children}
    </div>
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-right text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  )
}

function SectionCard({
  title,
  description,
  section,
  open,
  onToggle,
  onSave,
  onReset,
  saving,
  children,
}: {
  title: string
  description: string
  section: string
  open: boolean
  onToggle: () => void
  onSave: () => void
  onReset: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-right hover:bg-muted/40 transition-colors"
      >
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {children}
          <Separator />
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={saving}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="size-3.5" />
              استعادة الافتراضي
            </Button>
            <Button onClick={onSave} disabled={saving} size="sm" className="gap-2">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              حفظ {title}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Image upload field ─────────────────────────────────────────────────────

function ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  hint?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('اختر ملف صورة')
      return
    }
    setUploading(true)
    try {
      const res = await uploadFiles('siteImage', { files: [file] })
      if (!res || !res[0]) throw new Error('فشل الرفع')
      const url = res[0].url
      onChange(url)
      toast.success('تم رفع الصورة')
    } catch (e) {
      toast.error(`فشل رفع الصورة: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... أو /public/image.webp"
          className="text-left flex-1"
          dir="ltr"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-2 shrink-0"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          رفع
        </Button>
      </div>
      {value && (
        <img src={value} alt="preview" className="mt-2 h-16 w-auto rounded-lg border border-border object-cover" />
      )}
    </div>
  )
}

// ── Generic list editor ────────────────────────────────────────────────────

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              placeholder={placeholder}
              className="text-right flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, ''])}
          className="gap-2"
        >
          <Plus className="size-3.5" />
          إضافة
        </Button>
      </div>
    </div>
  )
}

// ── Section editors ────────────────────────────────────────────────────────

function HeroEditor({ value, onChange }: { value: HeroContent; onChange: (v: HeroContent) => void }) {
  const set = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="البادج (النص الصغير فوق العنوان)">
        <Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="السطر الأول من العنوان">
          <Input value={value.titleLine1} onChange={(e) => set('titleLine1', e.target.value)} className="text-right" />
        </Field>
        <Field label="السطر الثاني (اكتب {highlight} مكان الكلمة الذهبية)">
          <Input value={value.titleLine2} onChange={(e) => set('titleLine2', e.target.value)} className="text-right" />
        </Field>
        <Field label="الكلمة المميزة (highlight)">
          <Input value={value.titleHighlight} onChange={(e) => set('titleHighlight', e.target.value)} className="text-right" />
        </Field>
      </div>
      <Field label="الوصف">
        <Textarea value={value.description} onChange={(v) => set('description', v)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص الزر الأول">
          <Input value={value.cta1Text} onChange={(e) => set('cta1Text', e.target.value)} className="text-right" />
        </Field>
        <Field label="رابط الزر الأول">
          <Input value={value.cta1Href} onChange={(e) => set('cta1Href', e.target.value)} dir="ltr" />
        </Field>
        <Field label="نص الزر الثاني">
          <Input value={value.cta2Text} onChange={(e) => set('cta2Text', e.target.value)} className="text-right" />
        </Field>
        <Field label="رابط الزر الثاني">
          <Input value={value.cta2Href} onChange={(e) => set('cta2Href', e.target.value)} dir="ltr" />
        </Field>
      </div>
      <StringListEditor
        label="نقاط الثقة (أول حصة مجانًا، ...)"
        items={value.trustPoints}
        onChange={(v) => set('trustPoints', v)}
        placeholder="أول حصة مجانًا"
      />
      <StringListEditor
        label="تسميات فقاعات المواد"
        items={value.pillLabels}
        onChange={(v) => set('pillLabels', v)}
        placeholder="تكامل"
      />
      <ImageField
        label="صورة الأستاذ (الوضع الفاتح)"
        value={value.teacherImageLight}
        onChange={(v) => set('teacherImageLight', v)}
        hint="مسار من public/ أو رابط خارجي"
      />
      <ImageField
        label="صورة الأستاذ (الوضع الداكن)"
        value={value.teacherImageDark}
        onChange={(v) => set('teacherImageDark', v)}
      />
      <Field label="النص البديل للصورة (alt)">
        <Input value={value.teacherImageAlt} onChange={(e) => set('teacherImageAlt', e.target.value)} className="text-right" />
      </Field>
      <Separator />
      <div>
        <p className="mb-2 text-sm font-medium text-foreground text-right">الأرقام الصغيرة (mini stats على صورة الهيرو)</p>
        <div className="space-y-3">
          {(value.miniStats ?? []).map((stat, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  type="button" variant="ghost" size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => set('miniStats', value.miniStats.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <p className="text-xs font-semibold text-muted-foreground">{stat.prefix}{stat.value}{stat.suffix} — {stat.label}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="البادئة (prefix)">
                  <Input value={stat.prefix} onChange={(e) => { const n = [...value.miniStats]; n[i] = { ...stat, prefix: e.target.value }; set('miniStats', n) }} dir="ltr" />
                </Field>
                <Field label="الرقم">
                  <Input type="number" value={stat.value} onChange={(e) => { const n = [...value.miniStats]; n[i] = { ...stat, value: Number(e.target.value) }; set('miniStats', n) }} dir="ltr" />
                </Field>
                <Field label="اللاحقة (suffix)">
                  <Input value={stat.suffix} onChange={(e) => { const n = [...value.miniStats]; n[i] = { ...stat, suffix: e.target.value }; set('miniStats', n) }} dir="ltr" />
                </Field>
                <Field label="التسمية">
                  <Input value={stat.label} onChange={(e) => { const n = [...value.miniStats]; n[i] = { ...stat, label: e.target.value }; set('miniStats', n) }} className="text-right" />
                </Field>
              </div>
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => set('miniStats', [...(value.miniStats ?? []), { prefix: '', value: 0, suffix: '+', label: '' }])}
            className="gap-2"
          >
            <Plus className="size-3.5" />إضافة رقم
          </Button>
        </div>
      </div>
    </div>
  )
}

function FeaturesEditor({ value, onChange }: { value: FeaturesContent; onChange: (v: FeaturesContent) => void }) {
  const set = <K extends keyof FeaturesContent>(k: K, v: FeaturesContent[K]) => onChange({ ...value, [k]: v })
  const updateItem = (i: number, patch: Partial<FeatureItem>) => {
    const next = value.items.map((item, idx) => idx === i ? { ...item, ...patch } : item)
    set('items', next)
  }
  return (
    <div className="space-y-4">
      <Field label="البادج"><Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" /></Field>
      <Field label="العنوان"><Input value={value.title} onChange={(e) => set('title', e.target.value)} className="text-right" /></Field>
      <Field label="الوصف"><Textarea value={value.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <Separator />
      <p className="text-sm font-medium text-foreground text-right">المميزات</p>
      {value.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => set('items', value.items.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground">{item.step} — {item.title}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم الخطوة"><Input value={item.step} onChange={(e) => updateItem(i, { step: e.target.value })} className="text-right" /></Field>
            <Field label="اسم الأيقونة" hint="lightbulb / video / clipboard / chart"><Input value={item.icon} onChange={(e) => updateItem(i, { icon: e.target.value })} dir="ltr" /></Field>
            <Field label="العنوان"><Input value={item.title} onChange={(e) => updateItem(i, { title: e.target.value })} className="text-right sm:col-span-2" /></Field>
          </div>
          <Field label="الوصف"><Textarea value={item.description} onChange={(v) => updateItem(i, { description: v })} rows={2} /></Field>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set('items', [...value.items, { step: `٠${value.items.length + 1}`, title: '', description: '', icon: 'lightbulb' }])} className="gap-2">
        <Plus className="size-3.5" />إضافة ميزة
      </Button>
    </div>
  )
}

function StatsEditor({ value, onChange }: { value: StatsContent; onChange: (v: StatsContent) => void }) {
  const set = <K extends keyof StatsContent>(k: K, v: StatsContent[K]) => onChange({ ...value, [k]: v })
  const updateItem = (i: number, patch: Partial<StatItem>) => {
    const next = value.items.map((item, idx) => idx === i ? { ...item, ...patch } : item)
    set('items', next)
  }
  return (
    <div className="space-y-4">
      <Field label="البادج"><Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" /></Field>
      <Field label="العنوان"><Input value={value.title} onChange={(e) => set('title', e.target.value)} className="text-right" /></Field>
      <Field label="الوصف"><Textarea value={value.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <Separator />
      <p className="text-sm font-medium text-foreground text-right">الأرقام</p>
      {value.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => set('items', value.items.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground">{item.value}{item.suffix}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="القيمة (رقم)">
              <Input type="number" value={item.value} onChange={(e) => updateItem(i, { value: Number(e.target.value) })} dir="ltr" />
            </Field>
            <Field label="اللاحقة" hint="+ أو % أو k">
              <Input value={item.suffix} onChange={(e) => updateItem(i, { suffix: e.target.value })} dir="ltr" />
            </Field>
            <Field label="التسمية">
              <Input value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} className="text-right" />
            </Field>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set('items', [...value.items, { value: 0, suffix: '+', label: '' }])} className="gap-2">
        <Plus className="size-3.5" />إضافة رقم
      </Button>
    </div>
  )
}

function JourneyEditor({ points, onChange }: { points: JourneyPoint[]; onChange: (v: JourneyPoint[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground text-right">نقاط الرحلة (شهر + درجة)</p>
      {points.map((pt, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={pt.month} onChange={(e) => { const n = [...points]; n[i] = { ...pt, month: e.target.value }; onChange(n) }} placeholder="شهر" className="text-right w-32 shrink-0" />
          <Input type="number" value={pt.score} onChange={(e) => { const n = [...points]; n[i] = { ...pt, score: Number(e.target.value) }; onChange(n) }} placeholder="0" dir="ltr" className="w-20 shrink-0" />
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => onChange(points.filter((_, idx) => idx !== i))}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...points, { month: '', score: 0 }])} className="gap-1.5">
        <Plus className="size-3" />إضافة نقطة
      </Button>
    </div>
  )
}

function TestimonialsEditor({ value, onChange }: { value: TestimonialsContent; onChange: (v: TestimonialsContent) => void }) {
  const set = <K extends keyof TestimonialsContent>(k: K, v: TestimonialsContent[K]) => onChange({ ...value, [k]: v })
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const updateItem = (i: number, patch: Partial<TestimonialItem>) => {
    const next = value.items.map((item, idx) => idx === i ? { ...item, ...patch } : item)
    set('items', next)
  }
  return (
    <div className="space-y-4">
      <Field label="البادج"><Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" /></Field>
      <Field label="العنوان"><Input value={value.title} onChange={(e) => set('title', e.target.value)} className="text-right" /></Field>
      <Field label="الوصف"><Textarea value={value.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <Separator />
      <p className="text-sm font-medium text-foreground text-right">التقييمات</p>
      {value.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3 text-right hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); set('items', value.items.filter((_, idx) => idx !== i)) }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <p className="text-sm font-semibold text-foreground">{item.name} — {item.grade}</p>
          </button>
          {openIdx === i && (
            <div className="border-t border-border p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الاسم"><Input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="text-right" /></Field>
                <Field label="المرحلة الدراسية"><Input value={item.grade} onChange={(e) => updateItem(i, { grade: e.target.value })} className="text-right" /></Field>
                <Field label="المادة"><Input value={item.subject} onChange={(e) => updateItem(i, { subject: e.target.value })} className="text-right" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="قبل (%)"><Input type="number" value={item.before} onChange={(e) => updateItem(i, { before: Number(e.target.value) })} dir="ltr" /></Field>
                  <Field label="بعد (%)"><Input type="number" value={item.after} onChange={(e) => updateItem(i, { after: Number(e.target.value) })} dir="ltr" /></Field>
                </div>
              </div>
              <Field label="التقييم المكتوب"><Textarea value={item.quote} onChange={(v) => updateItem(i, { quote: v })} rows={3} /></Field>
              <JourneyEditor points={item.journey} onChange={(j) => updateItem(i, { journey: j })} />
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set('items', [...value.items, { name: '', grade: '', subject: '', quote: '', before: 0, after: 0, journey: [] }])} className="gap-2">
        <Plus className="size-3.5" />إضافة تقييم
      </Button>
    </div>
  )
}

function CtaEditor({ value, onChange }: { value: CtaContent; onChange: (v: CtaContent) => void }) {
  const set = <K extends keyof CtaContent>(k: K, v: CtaContent[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="البادج"><Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" /></Field>
      <Field label="العنوان"><Input value={value.title} onChange={(e) => set('title', e.target.value)} className="text-right" /></Field>
      <Field label="الوصف"><Textarea value={value.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص الزر الأول"><Input value={value.cta1Text} onChange={(e) => set('cta1Text', e.target.value)} className="text-right" /></Field>
        <Field label="رابط الزر الأول"><Input value={value.cta1Href} onChange={(e) => set('cta1Href', e.target.value)} dir="ltr" /></Field>
        <Field label="نص الزر الثاني"><Input value={value.cta2Text} onChange={(e) => set('cta2Text', e.target.value)} className="text-right" /></Field>
        <Field label="رابط الزر الثاني"><Input value={value.cta2Href} onChange={(e) => set('cta2Href', e.target.value)} dir="ltr" /></Field>
      </div>
      <StringListEditor label="مزايا الاشتراك (أسفل الأزرار)" items={value.perks} onChange={(v) => set('perks', v)} placeholder="أول حصة مجانًا" />
    </div>
  )
}

function LinksEditor({ label, links, onChange }: { label: string; links: FooterLink[]; onChange: (v: FooterLink[]) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <Input value={link.label} onChange={(e) => { const n = [...links]; n[i] = { ...link, label: e.target.value }; onChange(n) }} placeholder="الاسم" className="text-right flex-1" />
            <Input value={link.href} onChange={(e) => { const n = [...links]; n[i] = { ...link, href: e.target.value }; onChange(n) }} placeholder="/path" dir="ltr" className="flex-1" />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => onChange(links.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...links, { label: '', href: '' }])} className="gap-2">
          <Plus className="size-3.5" />إضافة رابط
        </Button>
      </div>
    </div>
  )
}

const SOCIAL_META: { platform: SocialPlatform; label: string; placeholder: string }[] = [
  { platform: 'website',   label: 'الموقع الرسمي',  placeholder: 'https://example.com' },
  { platform: 'telegram',  label: 'تليجرام',         placeholder: 'https://t.me/username' },
  { platform: 'whatsapp',  label: 'واتساب',          placeholder: 'https://wa.me/201000000000' },
  { platform: 'youtube',   label: 'يوتيوب',          placeholder: 'https://youtube.com/@channel' },
  { platform: 'facebook',  label: 'فيسبوك',          placeholder: 'https://facebook.com/page' },
  { platform: 'instagram', label: 'انستجرام',        placeholder: 'https://instagram.com/username' },
  { platform: 'tiktok',    label: 'تيك توك',         placeholder: 'https://tiktok.com/@username' },
  { platform: 'twitter',   label: 'تويتر / X',       placeholder: 'https://x.com/username' },
]

function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLink[]
  onChange: (v: SocialLink[]) => void
}) {
  // Ensure every platform is represented (merge saved values over the full list)
  const merged: SocialLink[] = SOCIAL_META.map((meta) => {
    const saved = value.find((s) => s.platform === meta.platform)
    return saved ?? { platform: meta.platform, href: '', enabled: false }
  })

  function update(platform: SocialPlatform, patch: Partial<SocialLink>) {
    onChange(merged.map((s) => (s.platform === platform ? { ...s, ...patch } : s)))
  }

  return (
    <div>
      <FieldLabel hint="فعّل المنصة وأضف الرابط — المنصات المعطّلة لا تظهر للزوار">
        حسابات السوشيال ميديا
      </FieldLabel>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border overflow-hidden">
        {merged.map((social) => {
          const meta = SOCIAL_META.find((m) => m.platform === social.platform)!
          return (
            <div key={social.platform} className="flex items-center gap-3 bg-background px-3 py-2.5">
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={social.enabled}
                onClick={() => update(social.platform, { enabled: !social.enabled })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  social.enabled ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${
                    social.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {/* Label */}
              <span className="w-28 shrink-0 text-right text-sm font-medium text-foreground">
                {meta.label}
              </span>
              {/* URL input */}
              <input
                type="url"
                dir="ltr"
                placeholder={meta.placeholder}
                value={social.href}
                onChange={(e) => update(social.platform, { href: e.target.value })}
                disabled={!social.enabled}
                className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-left text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FooterEditor({ value, onChange }: { value: FooterContent; onChange: (v: FooterContent) => void }) {
  const set = <K extends keyof FooterContent>(k: K, v: FooterContent[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الموقع"><Input value={value.siteName} onChange={(e) => set('siteName', e.target.value)} className="text-right" /></Field>
        <Field label="الشعار التعريفي (أسفل الاسم)"><Input value={value.siteTagline} onChange={(e) => set('siteTagline', e.target.value)} className="text-right" /></Field>
      </div>
      <Field label="الوصف"><Textarea value={value.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الهاتف"><Input value={value.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" /></Field>
        <Field label="العنوان"><Input value={value.address} onChange={(e) => set('address', e.target.value)} className="text-right" /></Field>
      </div>
      <LinksEditor label="الروابط السريعة" links={value.quickLinks} onChange={(v) => set('quickLinks', v)} />
      <SocialLinksEditor
        value={value.socialLinks ?? []}
        onChange={(v) => set('socialLinks', v)}
      />
      <Field label="نص حقوق الملكية" hint="استخدم {year} لوضع السنة تلقائيًا">
        <Input value={value.copyright} onChange={(e) => set('copyright', e.target.value)} className="text-right" />
      </Field>
    </div>
  )
}

function NavbarEditor({ value, onChange }: { value: NavbarContent; onChange: (v: NavbarContent) => void }) {
  const set = <K extends keyof NavbarContent>(k: K, v: NavbarContent[K]) => onChange({ ...value, [k]: v })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, startLogoUpload] = useTransition()

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    startLogoUpload(async () => {
      const res = await uploadFiles('siteImage', { files: [file] })
      if (!res || !res[0]) throw new Error('فشل الرفع')
      const url = res[0].url
      if (url) set('logoUrl', url)
    })
  }

  return (
    <div className="space-y-4">
      {/* Logo upload */}
      <div>
        <FieldLabel hint="الصورة تظهر بدلاً من أيقونة ƒ(x) الافتراضية في شريط التنقل">
          لوجو الموقع
        </FieldLabel>
        <div className="mt-2 flex items-center gap-4">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
            {value.logoUrl ? (
              <img src={value.logoUrl} alt="logo" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center font-mono text-lg font-bold text-muted-foreground">
                ƒ(x)
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingLogo}
              onClick={() => logoInputRef.current?.click()}
              className="gap-2"
            >
              {uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {uploadingLogo ? 'جاري الرفع...' : 'رفع لوجو'}
            </Button>
            {value.logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set('logoUrl', '')}
                className="text-destructive hover:text-destructive"
              >
                إزالة اللوجو
              </Button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      <Field label="اسم الموقع في الشريط"><Input value={value.siteName} onChange={(e) => set('siteName', e.target.value)} className="text-right" /></Field>
      <LinksEditor label="روابط القائمة" links={value.links} onChange={(v) => set('links', v)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="نص 'تسجيل الدخول'"><Input value={value.ctaLoginText} onChange={(e) => set('ctaLoginText', e.target.value)} className="text-right" /></Field>
        <Field label="نص 'ابدأ الآن'"><Input value={value.ctaRegisterText} onChange={(e) => set('ctaRegisterText', e.target.value)} className="text-right" /></Field>
        <Field label="نص 'حسابي'"><Input value={value.ctaAccountText} onChange={(e) => set('ctaAccountText', e.target.value)} className="text-right" /></Field>
      </div>
    </div>
  )
}

function SeoEditor({ value, onChange }: { value: SeoContent; onChange: (v: SeoContent) => void }) {
  const set = <K extends keyof SeoContent>(k: K, v: SeoContent[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="عنوان الصفحة (title)" hint="يظهر في تبويب المتصفح ونتائج البحث">
        <Input value={value.title} onChange={(e) => set('title', e.target.value)} className="text-right" />
      </Field>
      <Field label="وصف الصفحة (description)" hint="يظهر في نتائج البحث، يُفضّل 120-160 حرف">
        <Textarea value={value.description} onChange={(v) => set('description', v)} rows={3} />
      </Field>
      <Field
        label="الكلمات المفتاحية (Keywords)"
        hint="كلمات مفصولة بفاصلة — تُستخدم في وصف الصفحات الداخلية"
      >
        <Input
          value={value.keywords || ''}
          onChange={(e) => set('keywords', e.target.value)}
          className="text-right"
          placeholder="رياضيات ثانوي, شرح رياضيات, أولى ثانوي"
        />
      </Field>
      <Field
        label="كود التحقق من Google Search Console"
        hint="الكود من <meta name=google-site-verification> — اتركه فارغاً لو مش محتاجه"
      >
        <Input
          value={value.googleVerification || ''}
          onChange={(e) => set('googleVerification', e.target.value)}
          dir="ltr"
          className="text-left font-mono"
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص شاشة التحميل (Loader Text)" hint="النص الذي يظهر أسفل المعادلة الرياضية">
          <Input value={value.loaderText || ''} onChange={(e) => set('loaderText', e.target.value)} className="text-right" placeholder="جاري تجهيز المنصة..." />
        </Field>
        <Field label="معادلة شاشة التحميل" hint="مثال: f(x) = ∫ e^x dx (سيتم قسمها عند علامة = إذا وُجدت)">
          <Input value={value.loaderEquation || ''} onChange={(e) => set('loaderEquation', e.target.value)} dir="ltr" className="text-left font-mono" placeholder="f(x) = ∫ e^x dx" />
        </Field>
      </div>
    </div>
  )
}

function LoginPanelEditor({ value, onChange }: { value: LoginPanelContent; onChange: (v: LoginPanelContent) => void }) {
  const set = <K extends keyof LoginPanelContent>(k: K, v: LoginPanelContent[K]) => onChange({ ...value, [k]: v })
  const updateStat = (i: number, patch: Partial<LoginPanelStat>) => {
    const next = value.stats.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    set('stats', next)
  }
  return (
    <div className="space-y-4">
      <Field label="اسم المنصة / المدرس" hint="يظهر في صفحة تسجيل الدخول بدلاً من الاسم الثابت">
        <Input value={value.brandName ?? ''} onChange={(e) => set('brandName', e.target.value)} className="text-right" placeholder="مثال: عبد السلام" />
      </Field>
      <ImageField
        label="شعار المنصة (اختياري)"
        hint="يظهر بجانب الاسم في صفحة تسجيل الدخول — 40×40 بكسل على الأقل"
        value={value.logoUrl ?? ''}
        onChange={(v) => set('logoUrl', v)}
      />
      <Separator />
      <Field label="البادج (النص الصغير فوق العنوان)" hint="مثال: منصة الرياضيات الأولى للثانوية العامة">
        <Input value={value.badge} onChange={(e) => set('badge', e.target.value)} className="text-right" />
      </Field>
      <Field label="العنوان الرئيسي" hint="العنوان الكبير في الجانب الأيسر">
        <Textarea value={value.headline} onChange={(v) => set('headline', v)} rows={2} />
      </Field>
      <StringListEditor
        label="المميزات (قائمة علامات الصح)"
        items={value.perks}
        onChange={(v) => set('perks', v)}
        placeholder="مثال: شرح مبسّط لكل درس خطوة بخطوة"
      />
      <Separator />
      <p className="text-sm font-medium text-foreground text-right">الإحصائيات (الأرقام أسفل الصفحة)</p>
      {value.stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => set('stats', value.stats.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label="القيمة" hint="مثال: +48k أو 98%">
              <Input value={stat.value} onChange={(e) => updateStat(i, { value: e.target.value })} dir="ltr" />
            </Field>
            <Field label="التسمية">
              <Input value={stat.label} onChange={(e) => updateStat(i, { label: e.target.value })} className="text-right" />
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => set('stats', [...value.stats, { value: '', label: '' }])}
        className="gap-2"
      >
        <Plus className="size-3.5" />
        إضافة إحصائية
      </Button>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function SiteContentTab({ initialContent }: { initialContent: SiteContent }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [openSection, setOpenSection] = useState<string | null>(null)

  // Each section has its own local state and saving state
  const [hero, setHero] = useState<HeroContent>(initialContent.hero)
  const [features, setFeatures] = useState<FeaturesContent>(initialContent.features)
  const [stats, setStats] = useState<StatsContent>(initialContent.stats)
  const [testimonials, setTestimonials] = useState<TestimonialsContent>(initialContent.testimonials)
  const [cta, setCta] = useState<CtaContent>(initialContent.cta)
  const [footer, setFooter] = useState<FooterContent>(initialContent.footer)
  const [navbar, setNavbar] = useState<NavbarContent>(initialContent.navbar)
  const [seo, setSeo] = useState<SeoContent>(initialContent.seo)
  const [loginPanel, setLoginPanel] = useState<LoginPanelContent>(initialContent.login_panel)

  const [savingSection, setSavingSection] = useState<string | null>(null)

  async function save(section: string, value: unknown) {
    setSavingSection(section)
    const res = await updateSiteContentSection(section, value)
    setSavingSection(null)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('تم الحفظ. سيظهر التغيير فورًا للزوار.')
      router.refresh()
    }
  }

  async function reset(section: string, defaultValue: unknown) {
    setSavingSection(section)
    const res = await resetSiteContentSection(section)
    setSavingSection(null)
    if (res.error) {
      toast.error(res.error)
    } else {
      // restore local state to the passed-in default
      switch (section) {
        case 'hero': setHero(initialContent.hero); break
        case 'features': setFeatures(initialContent.features); break
        case 'stats': setStats(initialContent.stats); break
        case 'testimonials': setTestimonials(initialContent.testimonials); break
        case 'cta': setCta(initialContent.cta); break
        case 'footer': setFooter(initialContent.footer); break
        case 'navbar': setNavbar(initialContent.navbar); break
        case 'seo': setSeo(initialContent.seo); break
        case 'login_panel': setLoginPanel(initialContent.login_panel); break
      }
      toast.success('تمت استعادة القيم الافتراضية.')
      router.refresh()
    }
  }

  const sections = [
    {
      id: 'hero',
      title: 'قسم الهيرو',
      description: 'العنوان الرئيسي، الوصف، الأزرار، صورة الأستاذ، فقاعات المواد',
      editor: <HeroEditor value={hero} onChange={setHero} />,
      onSave: () => save('hero', hero),
      onReset: () => reset('hero', null),
    },
    {
      id: 'features',
      title: 'المميزات',
      description: 'عنوان القسم وقائمة الخطوات الأربع',
      editor: <FeaturesEditor value={features} onChange={setFeatures} />,
      onSave: () => save('features', features),
      onReset: () => reset('features', null),
    },
    {
      id: 'stats',
      title: 'الأرقام والإحصائيات',
      description: 'الأرقام الكبيرة التي تظهر في قسم الإحصائيات',
      editor: <StatsEditor value={stats} onChange={setStats} />,
      onSave: () => save('stats', stats),
      onReset: () => reset('stats', null),
    },
    {
      id: 'testimonials',
      title: 'آراء الطلاب',
      description: 'التقييمات المكتوبة مع الرسوم البيانية والدرجات',
      editor: <TestimonialsEditor value={testimonials} onChange={setTestimonials} />,
      onSave: () => save('testimonials', testimonials),
      onReset: () => reset('testimonials', null),
    },
    {
      id: 'cta',
      title: 'قسم الدعوة للتسجيل (CTA)',
      description: 'العنوان والأزرار والمميزات أسفل الشاشة',
      editor: <CtaEditor value={cta} onChange={setCta} />,
      onSave: () => save('cta', cta),
      onReset: () => reset('cta', null),
    },
    {
      id: 'footer',
      title: 'الفوتر (ذيل الصفحة)',
      description: 'الاسم، الوصف، الروابط السريعة، بيانات التواصل',
      editor: <FooterEditor value={footer} onChange={setFooter} />,
      onSave: () => save('footer', footer),
      onReset: () => reset('footer', null),
    },
    {
      id: 'navbar',
      title: 'شريط التنقل (Navbar)',
      description: 'اسم الموقع وروابط القائمة ونصوص الأزرار',
      editor: <NavbarEditor value={navbar} onChange={setNavbar} />,
      onSave: () => save('navbar', navbar),
      onReset: () => reset('navbar', null),
    },
    {
      id: 'seo',
      title: 'SEO والميتا',
      description: 'عنوان الصفحة ووصفها لمحركات البحث',
      editor: <SeoEditor value={seo} onChange={setSeo} />,
      onSave: () => save('seo', seo),
      onReset: () => reset('seo', null),
    },
    {
      id: 'login_panel',
      title: 'صفحة تسجيل الدخول',
      description: 'البادج، العنوان، المميزات، والإحصائيات في الجانب الأيسر',
      editor: <LoginPanelEditor value={loginPanel} onChange={setLoginPanel} />,
      onSave: () => save('login_panel', loginPanel),
      onReset: () => reset('login_panel', null),
    },

  ]

  return (
    <div className="space-y-2">
      <div className="text-right">
        <h3 className="text-lg font-bold text-foreground">محتوى الموقع</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          تحكّم في كل نص، عنوان، صورة، ورقم يظهر في الصفحات العامة. التغييرات تظهر فورًا للزوار.
        </p>
      </div>

      {/* Color control lives in Preferences tab — surface a shortcut here */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-right">
        <Palette className="size-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm text-muted-foreground">
          للتحكم في ألوان الواجهة الرئيسية، اذهب لتبويب{' '}
          <strong className="text-foreground">التفضيلات</strong> في نفس هذه الصفحة.
        </p>
      </div>

      <Separator className="my-4" />
      <div className="space-y-2">
        {sections.map((s) => (
          <SectionCard
            key={s.id}
            title={s.title}
            description={s.description}
            section={s.id}
            open={openSection === s.id}
            onToggle={() => setOpenSection(openSection === s.id ? null : s.id)}
            onSave={s.onSave}
            onReset={s.onReset}
            saving={savingSection === s.id}
          >
            {s.editor}
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
