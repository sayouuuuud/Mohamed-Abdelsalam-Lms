import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('123456', 10)
  const user = await prisma.user.update({
    where: { id: '0d545358-45b5-415c-aa05-8220619b9d86' },
    data: { encrypted_password: hash }
  })
  console.log('Successfully updated Ammar password to 123456:', user.email)
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
