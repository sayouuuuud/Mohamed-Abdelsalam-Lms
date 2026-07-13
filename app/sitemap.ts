import type { MetadataRoute } from 'next'
import { getCurriculum } from '@/lib/curriculum'
import { absoluteUrl } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // الصفحة الرئيسية
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]

  try {
    const stages = await getCurriculum()

    for (const stage of stages) {
      // صفحة المرحلة  /stages/[id]
      entries.push({
        url: absoluteUrl(`/stages/${stage.id}`),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.9,
      })

      for (const branch of stage.branches) {
        // صفحة الفرع  /stages/[id]/[branchId]
        entries.push({
          url: absoluteUrl(`/stages/${stage.id}/${branch.id}`),
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.8,
        })

        // صفحات الكورسات الشهرية  /stages/[id]/[branchId]/[courseId]
        for (const course of branch.monthlyCourses ?? []) {
          entries.push({
            url: absoluteUrl(`/stages/${stage.id}/${branch.id}/${course.id}`),
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }

        // صفحات المحاضرات المنفردة (خارج الكورسات الشهرية)
        const standaloneLectures = branch.lectures.filter((l) => !l.sectionId)
        for (const lecture of standaloneLectures) {
          entries.push({
            url: absoluteUrl(`/stages/${stage.id}/${branch.id}/${lecture.id}`),
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }
      }
    }
  } catch {
    // لو فشل جلب الـ DB نرجع الرئيسية فقط — الـ sitemap لا يجب أن يكسر الـ build
  }

  return entries
}
