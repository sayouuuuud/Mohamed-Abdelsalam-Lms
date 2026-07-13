// ── Light-mode accent presets ──────────────────────────────────────────────
// These drive the primary brand colors that appear in light mode on the landing page.
// The values map onto the CSS custom properties declared in globals.css:
//   --color-navy / --color-navy-deep / --color-navy-soft
//   --color-emerald-brand / --color-emerald-deep
//   --color-gold / --color-gold-deep

export const lightPresets = [
  {
    id: 'navy-gold',
    label: 'كحلي و ذهبي',
    navy: 'oklch(0.27 0.066 264)',
    navyDeep: 'oklch(0.2 0.055 264)',
    navySoft: 'oklch(0.42 0.07 264)',
    gold: 'oklch(0.77 0.125 84)',
    goldDeep: 'oklch(0.66 0.13 76)',
    emeraldBrand: 'oklch(0.56 0.12 159)',
    emeraldDeep: 'oklch(0.46 0.115 160)',
    swatch1: '#1e2a4a',
    swatch2: '#fbbf24',
  },
  {
    id: 'forest-sand',
    label: 'غابة و رمال',
    navy: 'oklch(0.3 0.08 150)', 
    navyDeep: 'oklch(0.22 0.07 150)',
    navySoft: 'oklch(0.45 0.09 150)',
    gold: 'oklch(0.8 0.1 80)', 
    goldDeep: 'oklch(0.7 0.11 75)',
    emeraldBrand: 'oklch(0.55 0.15 165)',
    emeraldDeep: 'oklch(0.45 0.14 165)',
    swatch1: '#114232',
    swatch2: '#F7C566',
  },
  {
    id: 'burgundy-blush',
    label: 'عنابي و وردي',
    navy: 'oklch(0.3 0.1 20)', 
    navyDeep: 'oklch(0.22 0.09 20)',
    navySoft: 'oklch(0.45 0.12 20)',
    gold: 'oklch(0.8 0.1 350)', 
    goldDeep: 'oklch(0.7 0.11 350)',
    emeraldBrand: 'oklch(0.55 0.15 15)',
    emeraldDeep: 'oklch(0.45 0.14 15)',
    swatch1: '#4a1525',
    swatch2: '#fca5a5',
  },
  {
    id: 'charcoal-blue',
    label: 'فحمي و أزرق',
    navy: 'oklch(0.25 0.02 240)', 
    navyDeep: 'oklch(0.18 0.02 240)',
    navySoft: 'oklch(0.4 0.02 240)',
    gold: 'oklch(0.65 0.15 250)', 
    goldDeep: 'oklch(0.55 0.16 250)',
    emeraldBrand: 'oklch(0.6 0.12 230)',
    emeraldDeep: 'oklch(0.5 0.12 230)',
    swatch1: '#1e2029',
    swatch2: '#3b82f6',
  },
  {
    id: 'aubergine-peach',
    label: 'باذنجاني و خوخي',
    navy: 'oklch(0.28 0.08 300)', 
    navyDeep: 'oklch(0.2 0.07 300)',
    navySoft: 'oklch(0.42 0.09 300)',
    gold: 'oklch(0.82 0.12 50)', 
    goldDeep: 'oklch(0.72 0.13 45)',
    emeraldBrand: 'oklch(0.58 0.14 290)',
    emeraldDeep: 'oklch(0.48 0.14 290)',
    swatch1: '#3b1c4a',
    swatch2: '#fb923c',
  },
] as const

export type LightPresetId = (typeof lightPresets)[number]['id']

export const DEFAULT_LIGHT_PRESET: LightPresetId = 'navy-gold'

/**
 * Apply a light preset by writing its CSS custom properties onto <html>.
 * Safe to call on the client only.
 */
export function applyLightPreset(id: LightPresetId | string) {
  const preset = lightPresets.find((p) => p.id === id)
  if (!preset) return
  const root = document.documentElement
  root.style.setProperty('--color-navy', preset.navy)
  root.style.setProperty('--color-navy-deep', preset.navyDeep)
  root.style.setProperty('--color-navy-soft', preset.navySoft)
  root.style.setProperty('--color-gold', preset.gold)
  root.style.setProperty('--color-gold-deep', preset.goldDeep)
  root.style.setProperty('--color-emerald-brand', preset.emeraldBrand)
  root.style.setProperty('--color-emerald-deep', preset.emeraldDeep)

  try {
    localStorage.setItem('light-preset', id)
  } catch {}
}
