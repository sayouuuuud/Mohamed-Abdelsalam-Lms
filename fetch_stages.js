const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.stages.findMany().then(console.log).finally(() => prisma.$disconnect());
