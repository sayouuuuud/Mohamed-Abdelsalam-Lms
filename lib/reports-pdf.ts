// Exports the reports page (charts, tables, and stats exactly as rendered)
// into a paginated A4 PDF. The page DOM is captured as a high-resolution
// image via html-to-image (which preserves Recharts SVGs and Arabic text
// perfectly), then sliced into A4 pages with jsPDF.

import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

// A4 dimensions in millimeters.
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 8

export async function exportReportsPdf(elementId: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error('لم يتم العثور على محتوى التقرير')

  // Resolve the real page background so the capture doesn't come out transparent.
  const bg =
    getComputedStyle(document.documentElement).backgroundColor ||
    getComputedStyle(document.body).backgroundColor ||
    '#ffffff'

  // Capture the whole report at 2x for crisp charts and text.
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: bg === 'rgba(0, 0, 0, 0)' ? '#ffffff' : bg,
    cacheBust: true,
    // Skip elements explicitly marked to be excluded (e.g. the export button).
    filter: (node) => {
      if (node instanceof HTMLElement && node.dataset?.exportExclude !== undefined) {
        return false
      }
      return true
    },
  })

  // Load the captured image to get its natural dimensions.
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('فشل تجهيز صورة التقرير'))
    img.src = dataUrl
  })

  const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2
  const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2

  // Pixels of the source image that fit on one PDF page.
  const pxPerMm = img.width / contentWidthMm
  const pageHeightPx = Math.floor(contentHeightMm * pxPerMm)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Slice the tall capture into page-sized chunks using an offscreen canvas.
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذر إنشاء لوحة الرسم')

  const totalPages = Math.ceil(img.height / pageHeightPx)

  for (let page = 0; page < totalPages; page++) {
    const sliceY = page * pageHeightPx
    const sliceHeight = Math.min(pageHeightPx, img.height - sliceY)

    canvas.height = sliceHeight
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, sliceY, img.width, sliceHeight, 0, 0, img.width, sliceHeight)

    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const sliceHeightMm = sliceHeight / pxPerMm

    if (page > 0) pdf.addPage()
    pdf.addImage(pageDataUrl, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, contentWidthMm, sliceHeightMm)
  }

  const today = new Date().toISOString().slice(0, 10)
  pdf.save(`تقرير-المنصة-${today}.pdf`)
}
