import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT id, video_id, status, attempts, last_error, updated_at 
      FROM video_jobs 
      ORDER BY updated_at DESC 
      LIMIT 5;
    `
    console.log('Recent jobs:', result)
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
