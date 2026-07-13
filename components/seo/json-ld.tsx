/**
 * مكوّن JsonLd — يحقن البيانات المنظمة (schema.org) بأمان
 * استخدام: <JsonLd data={{ "@context": "https://schema.org", ... }} />
 * ملاحظة: JSON.stringify يحمي من XSS — لا تحقن مدخلات مستخدم خام هنا.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
