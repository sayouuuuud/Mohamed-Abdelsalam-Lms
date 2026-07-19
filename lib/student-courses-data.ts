// الأنواع والـ utilities مُعرَّفة في lib/student-types.ts — re-export للتوافق مع الاستيرادات الموجودة
export type {
  LessonType,
  Lesson,
  Section,
  AssignmentStatus,
  AssignmentType,
  QuestionKind,
  QuizQuestion,
  Assignment,
  CourseItem,
  CourseDetail,
  EnrolledCourseLecture,
  EnrolledCourseSection,
  EnrolledMonthlyCourse,
  CourseProgress,
} from './student-types'

export {
  getCourseItems,
  getCourseLessons,
  getSectionItems,
  isAssignmentUnlocked,
} from './student-types'

/** @deprecated use getPurchasedCourseDetail() from student-lectures-data */
export function getCourseDetail(_id: string) {
  return undefined
}

/** @deprecated use getPurchasedAssignment() from student-lectures-data */
export function getAssignment(_id: string) {
  return undefined
}

/** @deprecated no mock data — use real DB queries */
export const courseDetails: import('./student-types').CourseDetail[] = []

/** @deprecated no mock data — use getStudentAssignments() server action */
export const assignments: import('./student-types').Assignment[] = []
