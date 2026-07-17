import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'video_jobs' AND c.conname = 'video_jobs_status_check';
    `
    console.log('Constraint:', result)
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
