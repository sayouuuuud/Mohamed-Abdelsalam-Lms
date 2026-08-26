const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'mr0197211122@gmail.com';
  console.log(`Checking user: ${email}`);

  const user = await prisma.user.findFirst({
    where: { email: email }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }
  console.log("User ID:", user.id);

  const student = await prisma.students.findFirst({
    where: { user_id: user.id }
  });

  if (!student) {
    console.log("Student profile not found for user!");
    return;
  }
  console.log("Student ID:", student.id);
  console.log("Student Stage ID:", student.stage_id);

  const stageId = student.stage_id ?? null;

  const enrollments = await prisma.enrollments.findMany({
    where: { student_id: student.id },
    select: { course_id: true }
  });
  const enrolledLectureIds = enrollments.map((e) => e.course_id).filter(Boolean);

  let orderedLectureIds = [];
  if (student.user_id) {
    const orderItems = await prisma.orders.findMany({
      where: {
        student_id: student.user_id,
        status: 'approved'
      },
      select: {
        order_items: { select: { lecture_id: true } }
      }
    });
    orderedLectureIds = orderItems
      .flatMap((o) => o.order_items.map((i) => i.lecture_id))
      .filter(Boolean);
  }

  const lectureIds = Array.from(new Set([...enrolledLectureIds, ...orderedLectureIds]));

  let branchIds = [];
  if (lectureIds.length > 0) {
    const lectures = await prisma.lectures.findMany({
      where: { id: { in: lectureIds } },
      select: { branch_id: true }
    });
    branchIds = Array.from(new Set(lectures.map((l) => l.branch_id).filter(Boolean)));
  }

  console.log("Targeting:", { stageId, lectureIds, branchIds });

  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' },
    select: { id: true, title: true, stage_id: true, branch_id: true }
  });

  console.log("Total published exams:", exams.length);

  const branchSet = new Set(branchIds);
  const visibleExams = exams.filter((e) => {
    const hasStageTarget = !!e.stage_id;
    const hasBranchTarget = !!e.branch_id;
    if (!hasStageTarget && !hasBranchTarget) return true;
    if (hasStageTarget && stageId && e.stage_id === stageId) return true;
    if (hasBranchTarget && e.branch_id && branchSet.has(e.branch_id)) return true;
    return false;
  });

  console.log("Visible exams for this student:");
  console.log(visibleExams);

}

main().catch(console.error).finally(() => prisma.$disconnect());
