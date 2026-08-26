const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stage = await prisma.stages.findUnique({
    where: { slug: 'stage-test_1787255603402_cmrjj' }
  });

  if (!stage) {
    console.log("Stage not found");
    return;
  }

  // Find branches for this stage
  const branches = await prisma.branches.findMany({ where: { stage_id: stage.id } });
  const branchIds = branches.map(b => b.id);
  
  if (branchIds.length > 0) {
    // Find lectures for these branches
    const lectures = await prisma.lectures.findMany({ where: { branch_id: { in: branchIds } } });
    const lectureIds = lectures.map(l => l.id);

    if (lectureIds.length > 0) {
      // Delete order items for these lectures
      await prisma.order_items.deleteMany({
        where: { lecture_id: { in: lectureIds } }
      });
      console.log(`Deleted order items for ${lectureIds.length} lectures`);
    }
  }

  // Delete students that reference this stage
  await prisma.students.deleteMany({
    where: { stage_id: stage.id }
  });

  // Finally delete the stage
  const result = await prisma.stages.delete({
    where: { id: stage.id }
  });

  console.log('Deleted stage:', result.slug);
}

main().catch(console.error).finally(() => prisma.$disconnect());
