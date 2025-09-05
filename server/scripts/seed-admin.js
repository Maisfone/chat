import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const name = process.env.ADMIN_NAME || 'Admin'
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env')
    process.exit(1)
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: hash, isAdmin: true },
    create: { name, email, password: hash, isAdmin: true }
  })
  console.log('Admin pronto:', { id: user.id, email: user.email })
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())

