'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function MathLoader({ 
  text = 'جاري تجهيز المنصة...',
  equation = 'f(x) = ∫ e^x dx'
}: { 
  text?: string
  equation?: string
}) {
  const pathname = usePathname()
  // The intro splash is a marketing flourish for the public landing/stages
  // pages only — it should never delay the student or admin portals.
  const isMarketing =
    pathname === '/' || pathname.startsWith('/stages')
  const [loading, setLoading] = useState(isMarketing)

  useEffect(() => {
    if (!isMarketing) {
      setLoading(false)
      return
    }
    // Check if it's the first time loading in this session
    const hasLoaded = sessionStorage.getItem('mathLoaded')
    if (hasLoaded) {
      setLoading(false)
      return
    }

    const timer = setTimeout(() => {
      setLoading(false)
      sessionStorage.setItem('mathLoaded', 'true')
    }, 1500)

    return () => clearTimeout(timer)
  }, [isMarketing])

  const parts = equation.split('=')
  const left = parts[0]?.trim() || ''
  const right = parts.length > 1 ? parts.slice(1).join('=').trim() : ''
  const hasEqual = parts.length > 1

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-cream dark:bg-ink-base"
        >
          <div className="flex flex-col items-center" dir="ltr">
            <motion.div
              className="text-4xl md:text-6xl lg:text-7xl font-serif text-navy dark:text-teal-glow tracking-widest flex items-center gap-4"
            >
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="font-bold italic"
              >
                {left}
              </motion.span>
              {hasEqual && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                  className="text-emerald-deep dark:text-white/50"
                >
                  =
                </motion.span>
              )}
              {right && (
                <motion.span
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ duration: 1.2, ease: 'easeInOut', delay: 1.2 }}
                  className="inline-block italic text-gold-deep dark:text-gold"
                >
                  {right}
                </motion.span>
              )}
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.5 }}
              className="mt-8 font-mono text-sm md:text-base tracking-widest text-ink-muted dark:text-ink-dim"
              dir="rtl"
            >
              {text}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
