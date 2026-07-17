const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function test() {
  try {
    const userCount = await prisma.user.count()
    console.log(`Users count: ${userCount}`)
    
    const studentsCount = await prisma.students.count()
    console.log(`Students count: ${studentsCount}`)
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `
    console.log(`Tables count: ${tables.length}`)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

test()
