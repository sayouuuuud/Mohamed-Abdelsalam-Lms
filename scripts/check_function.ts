import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'claim_next_video_job';
    `
    console.log('Result:', result)
  } catch (err) {
    console.error('Error:', err)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
