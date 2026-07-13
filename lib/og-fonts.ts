import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * يحمّل خطوط Cairo العربية (static TTF) من مجلد assets/fonts.
 * ملاحظات مهمة:
 * - satori (محرّك next/og) يدعم TTF/OTF/WOFF فقط — لا يدعم WOFF2.
 * - نقرأ الخط محلياً بـ fs بدل fetch لرابط خارجي هش (روابط gstatic تتغيّر وترجع 404).
 * - يتطلّب runtime = 'nodejs' في ملف الـ OG لأن fs غير متاح على edge.
 */
export async function loadCairoFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const [regular, bold] = await Promise.all([
    readFile(join(dir, 'cairo-400.ttf')),
    readFile(join(dir, 'cairo-700.ttf')),
  ])
  return [
    { name: 'Cairo', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Cairo', data: bold, weight: 700 as const, style: 'normal' as const },
  ]
}
