const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentsWithoutStage = await prisma.students.count({
    where: { stage_id: null }
  });

  const studentsWithStage = await prisma.students.count({
    where: { stage_id: { not: null } }
  });

  console.log("Students without stage:", studentsWithoutStage);
  console.log("Students with stage:", studentsWithStage);
}

main().catch(console.error).finally(() => prisma.$disconnect());
