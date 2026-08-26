const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get an old student (STD-1097 or similar)
  const oldStudents = await prisma.students.findMany({
    where: {
      code: { in: ['STD-1097', 'STD-1098', 'STD-1099', 'STD-1100'] }
    },
    select: { id: true, code: true, name: true, email: true, stage_id: true }
  });

  const stages = await prisma.stages.findMany({ select: { id: true, title: true, slug: true } });
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.title]));

  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' },
    select: { id: true, title: true, stage_id: true, branch_id: true }
  });

  for (const student of oldStudents) {
    console.log(`\n=== Student: ${student.code} | ${student.name} ===`);
    console.log(`stage_id: ${student.stage_id} => ${student.stage_id ? stageMap[student.stage_id] || 'STAGE NOT FOUND IN DB!' : 'NULL'}`);

    const stageExists = student.stage_id ? stages.some(s => s.id === student.stage_id) : false;
    console.log(`Stage exists in DB: ${stageExists}`);

    // Simulate what getStudentExams does
    const stageId = student.stage_id ?? null;
    const visibleExams = exams.filter((e) => {
      const hasStageTarget = !!e.stage_id;
      const hasBranchTarget = !!e.branch_id;
      if (!hasStageTarget && !hasBranchTarget) return true;
      if (hasStageTarget && stageId && e.stage_id === stageId) return true;
      return false;
    });
    console.log(`Visible exams: ${visibleExams.length}`);
    if (visibleExams.length > 0) console.log(visibleExams.map(e => e.title).join(', '));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
