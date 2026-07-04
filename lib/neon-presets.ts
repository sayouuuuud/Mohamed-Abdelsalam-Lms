// ── Dark-mode neon accent presets ───────────────────────────────────────────
// These drive the glowing accent colors that only appear in dark mode: the
// numbers, math symbols, ambient glows, and hover states across the landing
// page. Each preset defines a primary ("teal") and secondary ("violet") accent,
// each with a bright "glow" tone and a slightly darker "deep" tone.
//
// The values map onto the CSS custom properties declared in globals.css:
//   --color-teal-glow / --color-teal-deep      (primary neon accent)
//   --color-violet-glow / --color-violet-deep  (secondary neon accent)
//
// Kept as a plain module (no server imports) so it can be used from client
// components and serialized into the layout's inline theme script.

export const neonPresets = [
  {
    id: 'teal-violet',
    label: 'تيل و بنفسجي',
    tealGlow: 'oklch(0.84 0.13 184)',
    tealDeep: 'oklch(0.72 0.13 187)',
    violetGlow: 'oklch(0.66 0.2 292)',
    violetDeep: 'oklch(0.57 0.21 293)',
    swatch1: '#2dd4bf',
    swatch2: '#8b5cf6',
  },
  {
    id: 'cyan-blue',
    label: 'سماوي و أزرق',
    tealGlow: 'oklch(0.82 0.13 210)',
    tealDeep: 'oklch(0.7 0.13 212)',
    violetGlow: 'oklch(0.66 0.18 258)',
    violetDeep: 'oklch(0.57 0.19 260)',
    swatch1: '#22d3ee',
    swatch2: '#3b82f6',
  },
  {
    id: 'emerald-lime',
    label: 'زمردي و ليموني',
    tealGlow: 'oklch(0.83 0.16 158)',
    tealDeep: 'oklch(0.71 0.16 160)',
    violetGlow: 'oklch(0.85 0.18 128)',
    violetDeep: 'oklch(0.74 0.18 130)',
    swatch1: '#34d399',
    swatch2: '#a3e635',
  },
  {
    id: 'pink-orange',
    label: 'وردي و برتقالي',
    tealGlow: 'oklch(0.78 0.16 350)',
    tealDeep: 'oklch(0.67 0.18 352)',
    violetGlow: 'oklch(0.79 0.16 55)',
    violetDeep: 'oklch(0.7 0.17 50)',
    swatch1: '#f472b6',
    swatch2: '#fb923c',
  },
  {
    id: 'gold-red',
    label: 'ذهبي و أحمر',
    tealGlow: 'oklch(0.85 0.15 90)',
    tealDeep: 'oklch(0.75 0.15 88)',
    violetGlow: 'oklch(0.7 0.2 25)',
    violetDeep: 'oklch(0.6 0.21 25)',
    swatch1: '#fbbf24',
    swatch2: '#ef4444',
  },
] as const

export type NeonPresetId = (typeof neonPresets)[number]['id']

export const DEFAULT_NEON_PRESET: NeonPresetId = 'teal-violet'

/**
 * Apply a neon preset by writing its four CSS custom properties onto <html>.
 * The values are only *referenced* by `dark:` utilities, so setting them in any
 * mode is harmless — they simply take effect once dark mode is active.
 * Safe to call on the client only (touches document / localStorage).
 */
export function applyNeonPreset(id: NeonPresetId | string) {
  const preset = neonPresets.find((p) => p.id === id)
  if (!preset) return
  const root = document.documentElement
  root.style.setProperty('--color-teal-glow', preset.tealGlow)
  root.style.setProperty('--color-teal-deep', preset.tealDeep)
  root.style.setProperty('--color-violet-glow', preset.violetGlow)
  root.style.setProperty('--color-violet-deep', preset.violetDeep)

  try {
    localStorage.setItem('neon-preset', id)
  } catch {}
}
