const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.students.findMany({
    select: { id: true, name: true, email: true, code: true, stage_id: true }
  });

  const stages = await prisma.stages.findMany({
    select: { id: true, slug: true, title: true }
  });

  const stageMap = {};
  for (const s of stages) {
    stageMap[s.id] = s.title;
  }

  const distribution = {};
  for (const std of students) {
    const stageTitle = std.stage_id ? (stageMap[std.stage_id] || `Unknown Stage (${std.stage_id})`) : 'No Stage';
    distribution[stageTitle] = (distribution[stageTitle] || 0) + 1;
  }

  console.log("Stage distribution among all students:", distribution);
}

main().catch(console.error).finally(() => prisma.$disconnect());
