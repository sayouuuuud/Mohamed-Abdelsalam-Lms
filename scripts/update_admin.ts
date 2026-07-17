import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const newEmail = 'mohamedabdelslalam5@gmail.com'
  const newPassword = 'Abdelsalam@1431986'
  const hashedPassword = bcrypt.hashSync(newPassword, 10)

  // Find any user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
  })

  if (!admin) {
    console.log('No admin user found! Creating one...')
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: newEmail,
        encrypted_password: hashedPassword,
        role: 'admin',
        raw_user_meta_data: { name: 'Admin' }
      },
    })
    console.log('Admin user created successfully.')
    return
  }

  // Update existing admin
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      email: newEmail,
      encrypted_password: hashedPassword,
      role: 'admin'
    },
  })
  
  console.log(`Admin user updated successfully. Email: ${newEmail}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
