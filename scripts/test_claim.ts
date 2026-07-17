import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT * FROM claim_next_video_job();
    `
    console.log('Claim result:', result)
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
