const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulate() {
  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' },
    select: {
      id: true, code: true, title: true, course: true, duration: true,
      pass_mark: true, questions: true, status: true, created_at: true,
      stage_id: true, branch_id: true
    },
    orderBy: { created_at: 'desc' }
  });

  console.log('Exams:', exams);

  const visibleExams = exams.filter((e) => {
    const hasStageTarget = !!e.stage_id
    const hasBranchTarget = !!e.branch_id
    if (!hasStageTarget && !hasBranchTarget) return true
    // assume student matches
    return true;
  });

  console.log('Visible:', visibleExams);
}

simulate().finally(() => prisma.$disconnect());
