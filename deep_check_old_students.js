const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find old students and check if their user_id actually exists in the User table
  const oldStudents = await prisma.students.findMany({
    where: {
      code: { in: ['STD-1097', 'STD-1098', 'STD-1099', 'STD-1100'] }
    },
    select: { id: true, code: true, name: true, email: true, user_id: true, stage_id: true }
  });

  console.log(`Found ${oldStudents.length} old students`);

  for (const student of oldStudents) {
    console.log(`\n=== ${student.code} | ${student.name} ===`);
    console.log(`student.id: ${student.id}`);
    console.log(`student.user_id: ${student.user_id}`);
    
    if (student.user_id) {
      // Check if this user_id exists in the User table (auth table)
      const authUser = await prisma.user.findFirst({
        where: { id: student.user_id },
        select: { id: true, email: true }
      });
      
      if (authUser) {
        console.log(`Auth user found: ${authUser.email} (ID: ${authUser.id})`);
        console.log(`IDs match: ${authUser.id === student.user_id}`);
      } else {
        console.log(`AUTH USER NOT FOUND! user_id ${student.user_id} doesn't exist in auth!`);
      }
    } else {
      console.log(`user_id is NULL!`);
    }

    // Check profiles too
    if (student.user_id) {
      const profile = await prisma.profiles.findFirst({
        where: { id: student.user_id },
        select: { id: true, email: true, role: true }
      });
      if (profile) {
        console.log(`Profile role: ${profile.role}`);
      } else {
        console.log(`No profile found for this user_id`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
