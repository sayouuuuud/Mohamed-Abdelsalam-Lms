'use client'

import { useEffect, useRef } from 'react'
import Matter from 'matter-js'

type Pill = {
  label: string
  /** tailwind bg + text classes */
  className: string
  /** shape used by the physics body */
  shape?: 'pill' | 'circle'
  /** relative font scale */
  big?: boolean
}

const PILLS: Pill[] = [
  { label: 'تفاضل', className: 'bg-gold text-navy-deep dark:bg-violet-glow dark:text-white', big: true },
  { label: 'تكامل', className: 'bg-navy text-cream dark:bg-ink-raised dark:text-ink-fg dark:ring-1 dark:ring-ink-line', big: true },
  { label: 'جبر', className: 'bg-emerald-brand text-cream dark:bg-teal-glow dark:text-ink-base', big: true },
  { label: 'هندسة', className: 'bg-gold-deep text-cream dark:bg-violet-deep dark:text-white' },
  { label: 'مثلثات', className: 'bg-navy text-cream dark:bg-ink-raised dark:text-ink-fg dark:ring-1 dark:ring-ink-line' },
  { label: 'إحصاء', className: 'bg-emerald-deep text-cream dark:bg-teal-glow dark:text-ink-base' },
  { label: 'ميكانيكا', className: 'bg-gold text-navy-deep dark:bg-violet-glow dark:text-white', big: true },
  { label: 'احتمالات', className: 'bg-emerald-brand text-cream dark:bg-teal-glow dark:text-ink-base' },
  { label: 'π', className: 'bg-gold text-navy-deep dark:bg-violet-glow dark:text-white', shape: 'circle', big: true },
  { label: '√', className: 'bg-emerald-brand text-cream dark:bg-teal-glow dark:text-ink-base', shape: 'circle', big: true },
  { label: 'Σ', className: 'bg-navy text-cream dark:bg-ink-raised dark:text-ink-fg dark:ring-1 dark:ring-ink-line', shape: 'circle', big: true },
  { label: '∞', className: 'bg-gold-deep text-cream dark:bg-violet-deep dark:text-white', shape: 'circle' },
]

export function GravityPills() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const w = scene.clientWidth
    // Three tiers: very narrow phones (≤380px), wider phones (≤520px), desktop
    const scale = w <= 380 ? 0.44 : w <= 520 ? 0.54 : 1

    // shrink pills on narrow screens so the pile stays below the CTA content
    pillRefs.current.forEach((el, i) => {
      if (!el) return
      const p = PILLS[i]
      const base =
        p.shape === 'circle' ? (p.big ? 128 : 96) : p.big ? 104 : 84
      const h = Math.round(base * scale)
      el.style.height = `${h}px`
      if (p.shape === 'circle') el.style.width = `${h}px`
      el.style.fontSize = `${Math.round((p.big ? 40 : 30) * scale)}px`
    })

    const {
      Engine,
      Runner,
      World,
      Bodies,
      Body,
      Mouse,
      MouseConstraint,
      Composite,
      Events,
    } = Matter

    const engine = Engine.create()
    // gravity is ALWAYS on; reduced-motion users get a pre-settled pile (no
    // visible animation) rather than floating pills stuck off-screen.
    engine.gravity.y = 1

    let width = scene.clientWidth
    let height = scene.clientHeight
    const wall = 80

    const createWalls = () =>
      [
        // floor
        Bodies.rectangle(width / 2, height + wall / 2, width + wall * 2, wall, {
          isStatic: true,
        }),
        // left
        Bodies.rectangle(-wall / 2, height / 2, wall, height * 3, { isStatic: true }),
        // right
        Bodies.rectangle(width + wall / 2, height / 2, wall, height * 3, {
          isStatic: true,
        }),
      ]

    let walls = createWalls()
    World.add(engine.world, walls)

    // build a body per rendered pill element
    const bodies: { body: Matter.Body; el: HTMLDivElement }[] = []
    pillRefs.current.forEach((el, i) => {
      if (!el) return
      const w = el.offsetWidth
      const h = el.offsetHeight
      const isCircle = PILLS[i].shape === 'circle'
      // spread start X evenly across the width so the pile fills the whole floor
      const cols = pillRefs.current.length
      const colW = width / cols
      const startX = Math.min(
        width - w / 2,
        Math.max(w / 2, colW * (i + 0.5) + gsapRandom(-colW / 3, colW / 3)),
      )
      const startY = gsapRandom(-700, -60)
      const body = isCircle
        ? Bodies.circle(startX, startY, h / 2, {
            restitution: 0.35,
            friction: 0.4,
            frictionAir: 0.02,
          })
        : Bodies.rectangle(startX, startY, w, h, {
            chamfer: { radius: h / 2 },
            restitution: 0.35,
            friction: 0.4,
            frictionAir: 0.02,
          })
      Body.setAngle(body, gsapRandom(-0.4, 0.4))
      bodies.push({ body, el })
      World.add(engine.world, body)
    })

    // mouse drag
    const mouse = Mouse.create(scene)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    })
    World.add(engine.world, mouseConstraint)
    // allow page scroll over the canvas
    mouse.element.removeEventListener('wheel', (mouse as unknown as { mousewheel: EventListener }).mousewheel)
    mouse.element.removeEventListener(
      'DOMMouseScroll',
      (mouse as unknown as { mousewheel: EventListener }).mousewheel,
    )

    const runner = Runner.create()

    Events.on(engine, 'afterUpdate', () => {
      for (const { body, el } of bodies) {
        const { x, y } = body.position
        el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${
          y - el.offsetHeight / 2
        }px) rotate(${body.angle}rad)`
      }
    })

    // place every body at its start position before the first paint so the
    // pills are pinned above the fold (not flashing at 0,0)
    pillRefs.current.forEach((el, i) => {
      const entry = bodies[i]
      if (!el || !entry) return
      const { x, y } = entry.body.position
      el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${
        y - el.offsetHeight / 2
      }px) rotate(${entry.body.angle}rad)`
      el.style.opacity = '1'
    })

    const syncDom = () => {
      for (const { body, el } of bodies) {
        const { x, y } = body.position
        el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${
          y - el.offsetHeight / 2
        }px) rotate(${body.angle}rad)`
      }
    }

    let started = false
    let io: IntersectionObserver | null = null

    if (prefersReduced) {
      // pre-settle the pile synchronously so it appears already stacked (no
      // visible fall), then keep the runner alive so dragging still works
      for (let i = 0; i < 480; i++) Engine.update(engine, 1000 / 60)
      syncDom()
      started = true
      Runner.run(runner, engine)
    } else {
      // drop the pills once the section scrolls into view so the user watches
      // them fall — but guarantee it runs even if the observer never fires
      const startDrop = () => {
        if (started) return
        started = true
        width = scene.clientWidth
        height = scene.clientHeight
        Composite.remove(engine.world, walls)
        walls = createWalls()
        World.add(engine.world, walls)
        Runner.run(runner, engine)
      }
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) startDrop()
        },
        { threshold: 0.15 },
      )
      io.observe(scene)
      // fallback: if already on screen at mount, or the observer is flaky
      const rect = scene.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) startDrop()
      window.setTimeout(startDrop, 1800)
    }

    const handleResize = () => {
      const newW = scene.clientWidth
      const newH = scene.clientHeight
      if (newW === width && newH === height) return
      width = newW
      height = newH
      Composite.remove(engine.world, walls)
      walls = createWalls()
      World.add(engine.world, walls)
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(scene)

    return () => {
      io?.disconnect()
      ro.disconnect()
      Runner.stop(runner)
      World.clear(engine.world, false)
      Engine.clear(engine)
      Events.off(engine, 'afterUpdate')
    }
  }, [])

  return (
    <div
      ref={sceneRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      aria-hidden="true"
    >
      {PILLS.map((p, i) => (
        <div
          key={p.label}
          ref={(el) => {
            pillRefs.current[i] = el
          }}
          className={`absolute left-0 top-0 flex select-none items-center justify-center font-extrabold shadow-xl will-change-transform ${
            p.shape === 'circle' ? 'rounded-full' : 'rounded-full px-8'
          } ${p.className}`}
          style={{
            opacity: 0,
            height: p.shape === 'circle' ? (p.big ? 128 : 96) : p.big ? 104 : 84,
            width: p.shape === 'circle' ? (p.big ? 128 : 96) : undefined,
            fontSize: p.big ? 40 : 30,
          }}
        >
          {p.label}
        </div>
      ))}
    </div>
  )
}

// small inline random helper (avoids importing gsap here)
function gsapRandom(min: number, max: number) {
  return Math.random() * (max - min) + min
}
