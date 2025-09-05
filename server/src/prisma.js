import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// Log events úteis em desenvolvimento
try {
  prisma.$on('warn', (e) => console.warn('[Prisma warn]', e))
  prisma.$on('error', (e) => console.error('[Prisma error]', e))
} catch {}
