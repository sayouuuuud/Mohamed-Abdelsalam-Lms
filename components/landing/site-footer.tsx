import Link from 'next/link'
import {
  Sigma, Globe, Send, MessageCircle, Phone,
  Video, Camera, X, Share2,
} from 'lucide-react'
import type { FooterContent, SocialPlatform } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

const SOCIAL_ICON: Record<SocialPlatform, React.ElementType> = {
  website:   Globe,
  telegram:  Send,
  whatsapp:  MessageCircle,
  youtube:   Video,      // closest available in this lucide version
  facebook:  Share2,     // closest available in this lucide version
  instagram: Camera,     // closest available in this lucide version
  tiktok:    Globe,      // lucide doesn't ship TikTok; Globe is a safe fallback
  twitter:   X,          // X / Twitter
}

const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  website:   'الموقع الرسمي',
  telegram:  'تليجرام',
  whatsapp:  'واتساب',
  youtube:   'يوتيوب',
  facebook:  'فيسبوك',
  instagram: 'انستجرام',
  tiktok:    'تيك توك',
  twitter:   'تويتر / X',
}

export function SiteFooter({ content = DEFAULT_SITE_CONTENT.footer }: { content?: FooterContent }) {
  const copyright = content.copyright.replace('{year}', String(new Date().getFullYear()))

  return (
    <footer className="bg-navy-deep text-cream/70 dark:bg-ink-base dark:text-ink-dim">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gold text-navy dark:bg-teal-glow dark:text-ink-base">
              <Sigma className="size-6" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold text-cream">
                {content.siteName}
              </span>
              <span className="block text-xs text-emerald-brand">
                {content.siteTagline}
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-pretty leading-relaxed">
            {content.description}
          </p>
          {(content.socialLinks ?? DEFAULT_SITE_CONTENT.footer.socialLinks)
            .filter((s) => s.enabled)
            .length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              {(content.socialLinks ?? DEFAULT_SITE_CONTENT.footer.socialLinks)
                .filter((s) => s.enabled)
                .map((social) => {
                  const Icon = SOCIAL_ICON[social.platform]
                  return (
                    <a
                      key={social.platform}
                      href={social.href || '#'}
                      target={social.href && social.href !== '#' ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cream transition-colors hover:bg-gold hover:text-navy dark:hover:bg-teal-glow dark:hover:text-ink-base"
                      aria-label={SOCIAL_LABEL[social.platform]}
                    >
                      <Icon className="size-5" />
                    </a>
                  )
                })}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-bold text-cream">روابط سريعة</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {content.quickLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-gold">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-cream">تواصل معنا</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-gold dark:text-teal-glow" />
              <span dir="ltr">{content.phone}</span>
            </li>
            <li>{content.address}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-sm">
        {copyright}
      </div>
    </footer>
  )
}
