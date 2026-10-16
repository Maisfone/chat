import { PrismaClient } from '@prisma/client'

// O padrão do Prisma é (núcleos de CPU x 2 + 1) conexões, pouco para muitos usuários
// simultâneos num servidor pequeno. Usa 20 se a DATABASE_URL não definir connection_limit.
function databaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DB_POOL_SIZE || '20')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } })

// Log events úteis em desenvolvimento
try {
  prisma.$on('warn', (e) => console.warn('[Prisma warn]', e))
  prisma.$on('error', (e) => console.error('[Prisma error]', e))
} catch {}
