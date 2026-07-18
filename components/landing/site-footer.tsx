import Link from 'next/link'
import {
  Sigma, Globe, Send, MessageCircle, Phone,
  Video, Camera, X, Share2,
} from 'lucide-react'
import type { FooterContent, SocialPlatform } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

const SvgIcon = ({ path, className }: { path: string; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d={path} />
  </svg>
)

const SOCIAL_ICON: Record<SocialPlatform, React.ElementType> = {
  website: Globe,
  telegram: ({ className }) => <SvgIcon className={className} path="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.888-.666 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />,
  whatsapp: ({ className }) => <SvgIcon className={className} path="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />,
  youtube: ({ className }) => <SvgIcon className={className} path="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
  facebook: ({ className }) => <SvgIcon className={className} path="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-1.125 0-2.522.326-2.522 1.991v1.989h3.696l-.924 3.667h-2.772v7.98h-4.509z" />,
  instagram: ({ className }) => <SvgIcon className={className} path="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />,
  tiktok: ({ className }) => <SvgIcon className={className} path="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />,
  twitter: ({ className }) => <SvgIcon className={className} path="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />,
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
