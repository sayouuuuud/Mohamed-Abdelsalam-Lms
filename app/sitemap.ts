import type { MetadataRoute } from 'next'
import { getCurriculum } from '@/lib/curriculum'
import { absoluteUrl } from '@/lib/seo'

export const revalidate = 3600

function pathSegment(value: string): string {
  return encodeURIComponent(value.trim())
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>()

  const addEntry = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ) => {
    const url = absoluteUrl(path)
    entries.set(url, { url, changeFrequency, priority })
  }

  addEntry('/', 'weekly', 1)

  try {
    const stages = await getCurriculum()

    for (const stage of stages) {
      if (!stage.id) continue
      const stagePath = `/stages/${pathSegment(stage.id)}`
      addEntry(stagePath, 'monthly', 0.9)

      for (const branch of stage.branches) {
        if (!branch.id) continue
        const branchPath = `${stagePath}/${pathSegment(branch.id)}`
        addEntry(branchPath, 'monthly', 0.8)

        for (const course of branch.monthlyCourses ?? []) {
          if (!course.id || course.isPublished === false) continue
          addEntry(`${branchPath}/${pathSegment(course.id)}`, 'weekly', 0.7)
        }

        const courseLectureIds = new Set(
          (branch.monthlyCourses ?? []).flatMap((course) =>
            course.lectures.map((lecture) => lecture.id),
          ),
        )
        const standaloneLectures = branch.lectures.filter(
          (lecture) => !lecture.sectionId && !courseLectureIds.has(lecture.id),
        )
        for (const lecture of standaloneLectures) {
          if (!lecture.id) continue
          addEntry(`${branchPath}/${pathSegment(lecture.id)}`, 'weekly', 0.7)
        }
      }
    }
  } catch {
    // تظل الصفحة الرئيسية متاحة إذا تعذر الاتصال بقاعدة البيانات مؤقتًا.
  }

  return Array.from(entries.values())
}
