const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.stages.updateMany({
    where: { slug: 'sec-1' },
    data: { title: 'الصف الأول الثانوي' }
  });
  console.log("Updated sec-1 to الصف الأول الثانوي");
}

main().catch(console.error).finally(() => prisma.$disconnect());
