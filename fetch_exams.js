const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.exams.findMany({ select: { title: true, status: true, stage_id: true } }).then(console.log).finally(() => prisma.$disconnect());
