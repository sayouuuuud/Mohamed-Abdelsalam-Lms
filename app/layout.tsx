import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cairo, Geist_Mono, Aref_Ruqaa } from 'next/font/google'
import localFont from 'next/font/local'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { MathLoader } from '@/components/landing/math-loader'
import { CartProvider } from '@/components/cart/cart-provider'
import { CartModal } from '@/components/cart/cart-modal'
import { PageViewTracker } from '@/components/analytics/page-view-tracker'
import { colorPresets } from '@/lib/color-presets'
import { neonPresets } from '@/lib/neon-presets'
import { lightPresets } from '@/lib/light-presets'
import { getSiteColor, getSiteNeon, getSiteLightPreset } from '@/app/admin/settings/actions'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getSiteContent } from '@/lib/site-content'
import { getSiteUrl } from '@/lib/seo'
import './globals.css'


const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
})
const arefRuqaa = Aref_Ruqaa({
  variable: '--font-aref-ruqaa',
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const lemonBrush = localFont({
  src: '../public/fonts/lemon-brush-arabic.otf',
  variable: '--font-hero',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteContent()
  const siteUrl = getSiteUrl()
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: seo.title,
      template: `%s | ${seo.title}`,
    },
    description: seo.description,
    keywords: seo.keywords || undefined,
    generator: 'v0.app',
    alternates: {
      canonical: '/',
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: 'website',
      locale: 'ar_EG',
      siteName: seo.title,
      title: seo.title,
      description: seo.description,
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
    ...(seo.googleVerification
      ? { verification: { google: seo.googleVerification } }
      : {}),
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1f33' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // اللون المحفوظ على مستوى الموقع — يُقرأ من جدول عام (site_theme) يقدر أي زائر
  // أو حساب يقراه، فيفضل ثابت عبر كل الأجهزة وحتى قبل تسجيل الدخول.
  let savedColor = 'navy'
  let savedNeon = 'teal-violet'
  let savedLight = 'navy-gold'
  let seoContent: any = null
  try {
    ;[savedColor, savedNeon, savedLight, { seo: seoContent }] = await Promise.all([
      getSiteColor(),
      getSiteNeon(),
      getSiteLightPreset(),
      getSiteContent(),
    ])

    const session = await auth()
    const userId = session?.user?.id
    if (userId) {
      const userProfile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: { color_preset: true, role: true }
      })
      if (userProfile && userProfile.role === 'student' && userProfile.color_preset) {
        savedColor = userProfile.color_preset
      }
    }
  } catch {
    // لو فشل الجلب نكمّل بالقيم الافتراضية
  }

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${arefRuqaa.variable} ${lemonBrush.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=localStorage.getItem('theme');
              var isDark = t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);
              if(isDark){document.documentElement.classList.add('dark')}
              
              var presets=${JSON.stringify(colorPresets)};
              // القيمة المحفوظة في قاعدة البيانات لها الأولوية (تزامن عبر الأجهزة)،
              // وبعدها localStorage كنسخة محلية سريعة، وأخيراً الافتراضي.
              var serverColor=${JSON.stringify(savedColor)};
              var c=serverColor||localStorage.getItem('color-preset')||'navy';
              try{localStorage.setItem('color-preset',c)}catch(e){}
              var preset=presets.find(function(p){return p.id===c});
              if(preset){
                var vals=isDark?preset.dark:preset.light;
                var root=document.documentElement;
                root.style.setProperty('--primary', vals.primary);
                root.style.setProperty('--ring', vals.ring);
                root.style.setProperty('--sidebar-primary', vals.sidebar);
                root.style.setProperty('--sidebar-accent', vals.sidebar);
                root.style.setProperty('--sidebar-ring', vals.ring);
              }

              // ألوان النيون للدارك مود — تُطبّق دائماً (لا تؤثر إلا تحت dark:)
              var neons=${JSON.stringify(neonPresets)};
              var serverNeon=${JSON.stringify(savedNeon)};
              var n=serverNeon||localStorage.getItem('neon-preset')||'teal-violet';
              try{localStorage.setItem('neon-preset',n)}catch(e){}
              var neon=neons.find(function(p){return p.id===n});
              if(neon){
                var r2=document.documentElement;
                r2.style.setProperty('--color-teal-glow', neon.tealGlow);
                r2.style.setProperty('--color-teal-deep', neon.tealDeep);
                r2.style.setProperty('--color-violet-glow', neon.violetGlow);
                r2.style.setProperty('--color-violet-deep', neon.violetDeep);
              }

              // ثيمات الوضع الفاتح
              var lights=${JSON.stringify(lightPresets)};
              var serverLight=${JSON.stringify(savedLight)};
              var l=serverLight||localStorage.getItem('light-preset')||'navy-gold';
              try{localStorage.setItem('light-preset',l)}catch(e){}
              var light=lights.find(function(p){return p.id===l});
              if(light){
                var r3=document.documentElement;
                r3.style.setProperty('--color-navy', light.navy);
                r3.style.setProperty('--color-navy-deep', light.navyDeep);
                r3.style.setProperty('--color-navy-soft', light.navySoft);
                r3.style.setProperty('--color-gold', light.gold);
                r3.style.setProperty('--color-gold-deep', light.goldDeep);
                r3.style.setProperty('--color-emerald-brand', light.emeraldBrand);
                r3.style.setProperty('--color-emerald-deep', light.emeraldDeep);
              }
            }catch(e){}})();`,
          }}
        />

      </head>
      <body className={`${cairo.className} font-sans antialiased`}>
        <ThemeProvider>
          <CartProvider>
            <MathLoader text={seoContent?.loaderText} equation={seoContent?.loaderEquation} />
            {children}
            <CartModal />
            <PageViewTracker />
          </CartProvider>
        </ThemeProvider>
        <Toaster 
          position="top-center" 
          dir="rtl" 
          theme="system" 
          toastOptions={{
            className: 'font-sans',
            classNames: {
              toast: 'group flex items-start bg-background/95 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-4 gap-4 text-right transition-all duration-300',
              title: 'text-foreground font-bold text-[15px] leading-none mb-1.5',
              description: 'text-muted-foreground text-[13px] leading-relaxed',
              actionButton: 'bg-primary text-primary-foreground font-semibold rounded-xl px-4 py-2 hover:bg-primary/90 transition-colors shrink-0',
              cancelButton: 'bg-muted text-muted-foreground font-semibold rounded-xl px-4 py-2 hover:bg-muted/80 transition-colors shrink-0',
              success: 'border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20',
              error: 'border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/10 dark:border-rose-500/20',
              info: 'border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/10 dark:border-blue-500/20',
              warning: 'border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/10 dark:border-amber-500/20',
              icon: 'size-5 mt-0.5 shrink-0',
            }
          }}
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
