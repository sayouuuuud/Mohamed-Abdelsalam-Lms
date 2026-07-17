import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'mohamedabdelslalam5@gmail.com' },
  })

  if (!admin) {
    console.log('Admin user not found')
    return
  }

  // Update profile
  const profile = await prisma.profiles.findFirst({
    where: { id: admin.id }
  })

  if (profile) {
    await prisma.profiles.update({
      where: { id: admin.id },
      data: { role: 'admin' }
    })
    console.log('Profile updated to admin')
  } else {
    await prisma.profiles.create({
      data: {
        id: admin.id,
        email: 'mohamedabdelslalam5@gmail.com',
        role: 'admin',
        full_name: 'Admin'
      }
    })
    console.log('Profile created with admin role')
  }

  // Find if there's a student record linked
  const student = await prisma.students.findFirst({
    where: { user_id: admin.id }
  })

  if (student) {
    console.log('Found linked student record, deleting it to prevent conflicts')
    await prisma.students.delete({
      where: { id: student.id }
    })
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
