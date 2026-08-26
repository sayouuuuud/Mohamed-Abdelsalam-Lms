const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Test for a specific old student: Hend Sherif (STD-1098)
  const userId = 'eeee4237-a5fa-4efc-8cf3-5bf07269f5a9';
  
  // Simulate exactly what getCurrentStudent() does
  const student = await prisma.students.findFirst({
    where: { user_id: userId }
  });
  
  console.log('Student found:', student ? `YES - ${student.code}` : 'NO');
  
  if (!student) {
    console.log('getCurrentStudent() would return null -> no exams shown');
    return;
  }

  // Now simulate getStudentTargeting()
  const stageId = student.stage_id ?? null;
  console.log('stageId:', stageId);

  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' },
    select: { id: true, title: true, stage_id: true, branch_id: true }
  });

  const visibleExams = exams.filter((e) => {
    const hasStageTarget = !!e.stage_id;
    const hasBranchTarget = !!e.branch_id;
    if (!hasStageTarget && !hasBranchTarget) return true;
    if (hasStageTarget && stageId && e.stage_id === stageId) return true;
    return false;
  });

  console.log(`Visible exams: ${visibleExams.length}`);
  
  // Check NextAuth sessions for this user
  const sessions = await prisma.session.findMany({
    where: { userId: userId }
  }).catch(e => { console.log('No sessions table or error:', e.message); return []; });
  
  console.log('Active sessions count:', sessions.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
