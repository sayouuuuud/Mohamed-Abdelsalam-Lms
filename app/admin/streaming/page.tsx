import { redirect } from 'next/navigation'

// هذه الصفحة اتنقلت — إعدادات الاستريمنج موجودة الآن في تاب التفضيلات
export const dynamic = 'force-dynamic'

export default function StreamingPage() {
  redirect('/admin/settings')
}
