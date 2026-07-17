'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { getPurchasedCourses } from '@/lib/student-lectures-data'

export async function getStudentEnrolledCourses() {
  const courses = await getPurchasedCourses()
  return courses.map((c: any) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    image: c.image,
    category: c.category,
    completedLessons: c.completedLessons,
    totalLessons: c.totalLessons,
    nextLesson: c.nextLesson,
    rating: c.rating,
    durationHours: c.durationHours,
  }))
}

export async function unenrollCourse(courseSlug: string) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'غير مسجّل الدخول.' }

  const student = await prisma.students.findFirst({
    where: { user_id: user.id },
    select: { id: true }
  })
  if (!student) return { error: 'حساب الطالب غير موجود.' }

  const lecture = await prisma.lectures.findFirst({
    where: { slug: courseSlug },
    select: { id: true }
  })
  if (!lecture) return { error: 'الكورس غير موجود.' }

  const orders = await prisma.orders.findMany({
    where: { student_id: user.id },
    select: { id: true }
  })
  const orderIds = orders.map((o) => o.id)

  if (orderIds.length > 0) {
    await prisma.order_items.deleteMany({
      where: {
        lecture_id: lecture.id,
        order_id: { in: orderIds }
      }
    })
  }

  revalidatePath('/student/courses')
  revalidatePath('/student')
  return { success: true }
}

export async function unenrollMonthlyCourse(courseDbId: string) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'غير مسجّل الدخول.' }

  const orders = await prisma.orders.findMany({
    where: { student_id: user.id },
    select: { id: true }
  })
  const orderIds = orders.map((o) => o.id)

  if (orderIds.length > 0) {
    await prisma.order_items.deleteMany({
      where: {
        monthly_course_id: courseDbId,
        order_id: { in: orderIds }
      }
    })
  }

  revalidatePath('/student/courses')
  revalidatePath('/student')
  return { success: true }
}
