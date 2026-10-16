import express from 'express'
import { prisma } from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { unreadCountsFor, lastMessagesFor } from '../lib/conversations.js'

const router = express.Router()
router.use(authRequired)

// Listar DMs do usuário atual com último recado (3 consultas no total)
router.get('/', async (req, res) => {
  const me = req.user.id
  const threads = await prisma.directThread.findMany({
    where: { OR: [{ userAId: me }, { userBId: me }] },
    include: {
      userA: { select: { id: true, name: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, avatarUrl: true } }
    },
    orderBy: { group: { lastMessageAt: 'desc' } }
  })
  const groupIds = threads.map((t) => t.groupId)
  const [unreadMap, lastMap] = await Promise.all([
    unreadCountsFor(me, groupIds),
    lastMessagesFor(groupIds)
  ])
  res.json(threads.map((t) => ({
    id: t.id,
    groupId: t.groupId,
    other: t.userA.id === me ? t.userB : t.userA,
    lastMessage: lastMap.get(t.groupId) || null,
    _unread: unreadMap.get(t.groupId) || 0
  })))
})

// Criar ou retornar DM com um usuário
// Buscar DM existente com um usuário (não cria)
router.get('/with/:userId', async (req, res) => {
  const me = req.user.id
  const other = req.params.userId
  const [a, b] = [me, other].sort()
  const thread = await prisma.directThread.findFirst({ where: { userAId: a, userBId: b } })
  if (!thread) return res.status(404).json({ error: 'DM não existente' })
  const full = await prisma.directThread.findUnique({
    where: { id: thread.id },
    include: {
      group: true,
      userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, email: true, avatarUrl: true } }
    }
  })
  const otherUser = full.userA.id === me ? full.userB : full.userA
  res.json({ groupId: full.groupId, other: otherUser })
})

// Criar ou retornar DM com um usuário (apenas admin por política)
router.post('/:userId', async (req, res) => {
  const me = req.user.id
  const other = req.params.userId
  if (me === other) return res.status(400).json({ error: 'Não é possível iniciar DM consigo mesmo' })
  // Não criar DM automaticamente para usuários comuns
  // Permite criar DM para qualquer usuário autenticado

  // Ordena ids para respeitar a unique [userAId, userBId]
  const [a, b] = [me, other].sort()

  let thread = await prisma.directThread.findFirst({ where: { userAId: a, userBId: b } })
  if (!thread) {
    // Verifica se usuário existe
    const exists = await prisma.user.findUnique({ where: { id: other }, select: { id: true, name: true } })
    if (!exists) return res.status(404).json({ error: 'Usuário não encontrado' })

    // Grupo, membros e vínculo são criados juntos (transação). Antes, dois pedidos
    // simultâneos criavam dois grupos "DM"; o segundo falhava no vínculo e o grupo
    // ficava órfão, aparecendo na lista como um grupo "DM" com 2 pessoas.
    try {
      thread = await prisma.$transaction(async (tx) => {
        const group = await tx.group.create({ data: { name: `DM`, isPrivate: true } })
        await tx.groupMember.createMany({ data: [
          { groupId: group.id, userId: me },
          { groupId: group.id, userId: other }
        ] })
        return tx.directThread.create({ data: { groupId: group.id, userAId: a, userBId: b } })
      })
    } catch (e) {
      // Outro pedido criou a mesma DM ao mesmo tempo: usa a que já existe
      if (e?.code !== 'P2002') throw e
      thread = await prisma.directThread.findFirst({ where: { userAId: a, userBId: b } })
      if (!thread) throw e
    }
  }

  // Retorna informações úteis
  const full = await prisma.directThread.findUnique({
    where: { id: thread.id },
    include: {
      group: true,
      userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, email: true, avatarUrl: true } }
    }
  })
  const otherUser = full.userA.id === me ? full.userB : full.userA
  try {
    // Notifica apenas os dois participantes (sala pessoal user:<id>)
    req.io?.to([`user:${full.userA.id}`, `user:${full.userB.id}`]).emit('dm:created', {
      groupId: full.groupId,
      userA: { id: full.userA.id, name: full.userA.name, avatarUrl: full.userA.avatarUrl },
      userB: { id: full.userB.id, name: full.userB.name, avatarUrl: full.userB.avatarUrl },
      createdAt: full.group?.createdAt || new Date().toISOString(),
    })
  } catch {}
  res.status(201).json({ groupId: full.groupId, other: otherUser })
})

export default router
