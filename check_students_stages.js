const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.students.findMany({
    select: { id: true, code: true, user_id: true, stage_id: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 10
  });

  const stages = await prisma.stages.findMany({
    select: { id: true, slug: true, title: true }
  });

  console.log("Stages:", stages);
  console.log("Recent Students:", students);
}

main().catch(console.error).finally(() => prisma.$disconnect());
