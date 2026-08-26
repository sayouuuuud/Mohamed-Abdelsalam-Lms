const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getStudentTargeting(student) {
  const stageId = student.stage_id ?? null

  const enrollments = await prisma.enrollments.findMany({
    where: { student_id: student.id },
    select: { course_id: true }
  })
  const enrolledLectureIds = enrollments.map((e) => e.course_id).filter(Boolean)

  let orderedLectureIds = []
  if (student.user_id) {
    const orderItems = await prisma.orders.findMany({
      where: {
        student_id: student.user_id,
        status: 'approved'
      },
      select: {
        order_items: { select: { lecture_id: true } }
      }
    })
    orderedLectureIds = orderItems
      .flatMap((o) => o.order_items.map((i) => i.lecture_id))
      .filter(Boolean)
  }

  const lectureIds = Array.from(new Set([...enrolledLectureIds, ...orderedLectureIds]))

  let branchIds = []
  if (lectureIds.length > 0) {
    const lectures = await prisma.lectures.findMany({
      where: { id: { in: lectureIds } },
      select: { branch_id: true }
    })
    branchIds = Array.from(new Set(lectures.map((l) => l.branch_id).filter(Boolean)))
  }

  return { stageId, lectureIds, branchIds }
}

async function main() {
  const oldStudent = await prisma.students.findFirst({
    where: { code: 'STD-1097' }
  });

  if (!oldStudent) {
    console.log("Old student not found");
    return;
  }

  const { stageId, branchIds } = await getStudentTargeting(oldStudent);
  console.log("Targeting:", { stageId, branchIds });

  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' }
  });

  const branchSet = new Set(branchIds);
  const visibleExams = exams.filter((e) => {
    const hasStageTarget = !!e.stage_id
    const hasBranchTarget = !!e.branch_id
    if (!hasStageTarget && !hasBranchTarget) return true
    if (hasStageTarget && stageId && e.stage_id === stageId) return true
    if (hasBranchTarget && e.branch_id && branchSet.has(e.branch_id)) return true
    return false
  });

  console.log("Visible exams for old student:", visibleExams.map(e => e.title));
}

main().catch(console.error).finally(() => prisma.$disconnect());
