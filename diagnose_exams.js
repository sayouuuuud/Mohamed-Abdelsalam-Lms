const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all published exams to understand their targeting
  const exams = await prisma.exams.findMany({
    where: { status: 'منشور' },
    select: { id: true, title: true, stage_id: true, branch_id: true }
  });

  console.log('=== Published Exams Targeting ===');
  for (const e of exams) {
    const hasStage = !!e.stage_id;
    const hasBranch = !!e.branch_id;
    if (!hasStage && !hasBranch) {
      console.log(`[ALL STUDENTS] ${e.title}`);
    } else if (hasStage) {
      console.log(`[STAGE: ${e.stage_id}] ${e.title}`);
    } else if (hasBranch) {
      console.log(`[BRANCH: ${e.branch_id}] ${e.title}`);
    }
  }

  console.log('\n=== Stages Available ===');
  const stages = await prisma.stages.findMany({ select: { id: true, title: true, slug: true } });
  for (const s of stages) {
    console.log(`${s.slug} => ID: ${s.id} => ${s.title}`);
  }

  console.log('\n=== Admin/Assistants check ===');
  const admins = await prisma.profiles.findMany({ select: { id: true, email: true, role: true } });
  console.log(`Admin profiles: ${admins.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
