const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Looking for orphaned users...");

  // Find all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, created_at: true },
    where: {
      // Only target users created today (or recently) to avoid messing with system accounts
      created_at: {
        gte: new Date('2026-08-25T00:00:00Z')
      }
    }
  });

  console.log(`Found ${users.length} recent users.`);

  let orphanedCount = 0;
  let fixedCount = 0;

  // We need a default stage to assign them to
  const defaultStage = await prisma.stages.findFirst({
    where: { slug: 'sec-1' } // Assuming sec-1 as a fallback
  });

  for (const user of users) {
    const student = await prisma.students.findFirst({
      where: { user_id: user.id }
    });

    const profile = await prisma.profiles.findFirst({
      where: { id: user.id }
    });

    if (!student && !profile) {
      orphanedCount++;
      console.log(`Found orphaned user: ${user.email} (ID: ${user.id})`);
      
      try {
        await prisma.students.create({
          data: {
            code: `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            user_id: user.id,
            name: 'طالب بدون بيانات', 
            email: user.email || `unknown_${user.id}@test.com`,
            phone: 'غير معروف',
            gender: 'ذكر',
            stage_id: defaultStage ? defaultStage.id : null,
            status: 'نشط',
            courses: 0,
            progress: 0,
            spent: '0 ج.م'
          }
        });
        console.log(` -> Fixed: Created student profile for ${user.email}`);
        fixedCount++;
      } catch (err) {
        console.error(` -> Failed to create student for ${user.email}:`, err.message);
      }
    }
  }

  console.log(`\nSummary:`);
  console.log(`Total orphaned users found: ${orphanedCount}`);
  console.log(`Successfully fixed: ${fixedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
