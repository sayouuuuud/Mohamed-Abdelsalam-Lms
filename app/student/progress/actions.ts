'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'

export async function markLessonComplete(lessonId: string, courseSlug?: string) {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return { error: 'يجب تسجيل الدخول.' }

  try {
    await prisma.student_content_progress.upsert({
      where: {
        user_id_item_type_item_id: {
          user_id: user.id as string,
          item_type: 'lesson',
          item_id: lessonId
        }
      },
      create: {
        user_id: user.id as string,
        item_type: 'lesson',
        item_id: lessonId,
        status: 'completed',
        updated_at: new Date()
      },
      update: {
        status: 'completed',
        updated_at: new Date()
      }
    })

    void recordLearningActivityFromLesson(user.id as string, lessonId)

    if (courseSlug) revalidatePath(`/student/courses/${courseSlug}`)
    revalidatePath('/student/courses')
    return { success: true }
  } catch (e) {
    return { error: 'تعذّر حفظ التقدّم.' }
  }
}

export async function recordLearningActivity(minutes: number) {
  if (minutes <= 0) return { error: 'المدة يجب أن تكون أكبر من صفر.' }

  const session = await auth()
  const user = session?.user
  if (!user?.id) return { error: 'يجب تسجيل الدخول.' }

  const studentRow = await prisma.students.findFirst({
    where: { user_id: user.id as string },
    select: { id: true }
  })
  if (!studentRow) return { error: 'لم يتم العثور على بيانات الطالب.' }

  const today = new Date().toISOString().split('T')[0]

  try {
    const existing = await prisma.learning_activity.findUnique({
      where: {
        student_id_activity_date: {
          student_id: studentRow.id,
          activity_date: today
        }
      },
      select: { minutes: true }
    })

    const newMinutes = (existing?.minutes ?? 0) + minutes

    await prisma.learning_activity.upsert({
      where: {
        student_id_activity_date: {
          student_id: studentRow.id,
          activity_date: today
        }
      },
      create: {
        student_id: studentRow.id,
        activity_date: today,
        minutes: newMinutes
      },
      update: {
        minutes: newMinutes
      }
    })

    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

async function recordLearningActivityFromLesson(userId: string, lessonId: string) {
  try {
    const lesson = await prisma.lessons.findUnique({
      where: { id: lessonId },
      select: { duration: true }
    })

    let minutes = 15
    if (lesson?.duration) {
      const parts = String(lesson.duration).split(':').map(Number)
      if (parts.length === 2) minutes = (parts[0] ?? 0) + (parts[1] ?? 0) / 60
      else if (parts.length === 3) minutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60
    }

    if (minutes <= 0) minutes = 15

    const studentRow = await prisma.students.findFirst({
      where: { user_id: userId },
      select: { id: true }
    })
    if (!studentRow) return

    const today = new Date().toISOString().split('T')[0]
    
    const existing = await prisma.learning_activity.findUnique({
      where: {
        student_id_activity_date: {
          student_id: studentRow.id,
          activity_date: today
        }
      },
      select: { minutes: true }
    })

    await prisma.learning_activity.upsert({
      where: {
        student_id_activity_date: {
          student_id: studentRow.id,
          activity_date: today
        }
      },
      create: {
        student_id: studentRow.id,
        activity_date: today,
        minutes: (existing?.minutes ?? 0) + Math.round(minutes)
      },
      update: {
        minutes: (existing?.minutes ?? 0) + Math.round(minutes)
      }
    })
  } catch (e) {
    console.error(e)
  }
}

export async function submitAssignmentProgress(
  assignmentCode: string,
  payload: { status: 'تم التسليم' | 'مصحّح'; score?: number; courseSlug?: string },
) {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return { error: 'يجب تسجيل الدخول.' }

  try {
    const studentRow = await prisma.students.findFirst({
      where: { user_id: user.id as string },
      select: { id: true }
    })
    if (!studentRow) return { error: 'لم يتم العثور على بيانات الطالب.' }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignmentCode)
    
    let asgRow
    if (isUuid) {
      asgRow = await prisma.assignments.findUnique({
        where: { id: assignmentCode },
        select: { id: true }
      })
    } else {
      asgRow = await prisma.assignments.findFirst({
        where: { code: assignmentCode },
        select: { id: true }
      })
    }
    
    if (!asgRow) return { error: 'الواجب غير موجود.' }

    await prisma.assignment_submissions.upsert({
      where: {
        assignment_id_student_id: {
          assignment_id: asgRow.id,
          student_id: studentRow.id
        }
      },
      create: {
        assignment_id: asgRow.id,
        student_id: studentRow.id,
        status: payload.status,
        score: payload.score ?? null,
        submitted_at: new Date()
      },
      update: {
        status: payload.status,
        score: payload.score ?? null,
        submitted_at: new Date()
      }
    })

    await prisma.student_content_progress.upsert({
      where: {
        user_id_item_type_item_id: {
          user_id: user.id as string,
          item_type: 'assignment',
          item_id: asgRow.id
        }
      },
      create: {
        user_id: user.id as string,
        item_type: 'assignment',
        item_id: asgRow.id,
        status: payload.status,
        score: payload.score ?? null,
        updated_at: new Date()
      },
      update: {
        status: payload.status,
        score: payload.score ?? null,
        updated_at: new Date()
      }
    })

    if (payload.courseSlug) revalidatePath(`/student/courses/${payload.courseSlug}`)
    revalidatePath('/student/assignments')
    return { success: true }
  } catch (e) {
    return { error: 'تعذّر حفظ التسليم.' }
  }
}
