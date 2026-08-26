const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'mr0197211122@gmail.com';
  console.log(`Checking user: ${email}`);

  const user = await prisma.user.findFirst({
    where: { email: email }
  });
  console.log("User in User table:", user);

  const studentByEmail = await prisma.students.findFirst({
    // We don't have email in students, let's just fetch recent students or search
  });

  const allStudents = await prisma.students.findMany({
    orderBy: { created_at: 'desc' },
    take: 10
  });
  console.log("Recent students:", allStudents);
}

main().catch(console.error).finally(() => prisma.$disconnect());
