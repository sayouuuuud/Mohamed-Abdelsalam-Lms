const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'mr0197211122@gmail.com';
  
  const user = await prisma.user.findFirst({
    where: { email: email }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  let student = await prisma.students.findFirst({
    where: { user_id: user.id }
  });

  if (!student) {
    console.log("Student profile missing. Creating one...");
    
    // Find stage for sec-3 (or just assign a default stage like sec-1)
    const stage = await prisma.stages.findFirst({
      where: { slug: 'sec-1' } // Assuming sec-1 for this fix, can be adjusted
    });

    if (!stage) {
       console.log("Could not find a stage to assign.");
       return;
    }

    student = await prisma.students.create({
      data: {
        code: `STD-${Date.now()}`,
        user_id: user.id,
        name: 'طالب بدون بيانات', // Placeholder
        email: email,
        phone: 'غير معروف',
        gender: 'ذكر',
        stage_id: stage.id,
        status: 'نشط',
        courses: 0,
        progress: 0,
        spent: '0 ج.م'
      }
    });
    console.log("Created missing student profile:", student.id);
  } else {
    console.log("Student profile already exists.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
