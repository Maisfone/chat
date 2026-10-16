// Corrige grupos "DM" órfãos: criados por pedidos simultâneos de DM (bug corrigido
// em routes/dm.js), sem vínculo DirectThread, que apareciam como grupos comuns.
//
// Uso:
//   node scripts/fix-orphan-dms.js            -> só mostra o que faria (não altera nada)
//   node scripts/fix-orphan-dms.js --aplicar  -> aplica as correções
//
// Para cada grupo "DM" órfão com exatamente 2 membros:
//   - se o par já tem uma DM: as mensagens do órfão são movidas para ela e o órfão é removido
//   - se o par ainda não tem DM: o órfão vira a DM oficial do par
// Grupos "DM" com número de membros diferente de 2 só são listados (não são alterados).
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--aplicar')

async function main() {
  const orphans = await prisma.group.findMany({
    where: { name: 'DM', directThread: { is: null } },
    orderBy: { createdAt: 'asc' },
    include: {
      members: { select: { userId: true, user: { select: { name: true } } } },
      _count: { select: { messages: true } },
    },
  })

  if (!orphans.length) {
    console.log('Nenhum grupo "DM" órfão encontrado.')
    return
  }
  console.log(`${orphans.length} grupo(s) "DM" órfão(s) encontrado(s).${apply ? '' : ' (simulação — use --aplicar para corrigir)'}\n`)

  const summary = { merged: 0, promoted: 0, movedMessages: 0, skipped: 0 }

  for (const g of orphans) {
    const names = g.members.map((m) => m.user?.name || m.userId).join(' + ')
    if (g.members.length !== 2) {
      console.log(`- ${g.id} (${g.members.length} membros: ${names || 'nenhum'}) -> ignorado, revisar manualmente`)
      summary.skipped++
      continue
    }
    const [a, b] = g.members.map((m) => m.userId).sort()
    const thread = await prisma.directThread.findFirst({ where: { userAId: a, userBId: b } })

    if (thread) {
      console.log(`- ${g.id} (${names}, ${g._count.messages} mensagens) -> juntar na DM existente ${thread.groupId}`)
      summary.merged++
      summary.movedMessages += g._count.messages
      if (!apply) continue
      await prisma.$transaction(async (tx) => {
        if (g._count.messages) {
          await tx.message.updateMany({ where: { groupId: g.id }, data: { groupId: thread.groupId } })
          const last = await tx.message.findFirst({
            where: { groupId: thread.groupId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
          if (last) await tx.group.update({ where: { id: thread.groupId }, data: { lastMessageAt: last.createdAt } })
        }
        await tx.groupMember.deleteMany({ where: { groupId: g.id } })
        await tx.group.delete({ where: { id: g.id } })
      })
    } else {
      console.log(`- ${g.id} (${names}, ${g._count.messages} mensagens) -> vira a DM oficial do par`)
      summary.promoted++
      if (!apply) continue
      await prisma.directThread.create({ data: { groupId: g.id, userAId: a, userBId: b } })
    }
  }

  console.log(
    `\nResumo: ${summary.merged} juntado(s) em DM existente (${summary.movedMessages} mensagens movidas), ` +
      `${summary.promoted} promovido(s) a DM, ${summary.skipped} ignorado(s).`
  )
  if (!apply) console.log('Nada foi alterado. Rode novamente com --aplicar para corrigir.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
