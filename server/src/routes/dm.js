import express from 'express'
import { prisma } from '../prisma.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()
router.use(authRequired)

// Listar DMs do usuário atual com último recado
router.get('/', async (req, res) => {
  const me = req.user.id
  const threads = await prisma.directThread.findMany({
    where: { OR: [{ userAId: me }, { userBId: me }] },
    include: {
      group: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      userA: { select: { id: true, name: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, avatarUrl: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  const data = await Promise.all(threads.map(async (t) => {
    const other = t.userA.id === me ? t.userB : t.userA
    const unread = await prisma.message.count({
      where: {
        groupId: t.groupId,
        deletedAt: null,
        authorId: { not: me },
        reads: { none: { userId: me } }
      }
    })
    return { id: t.id, groupId: t.groupId, other, lastMessage: t.group.messages[0] || null, _unread: unread }
  }))
  res.json(data)
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

    // Cria grupo privado e membros
    const group = await prisma.group.create({ data: { name: `DM`, isPrivate: true } })
    await prisma.groupMember.createMany({ data: [
      { groupId: group.id, userId: me },
      { groupId: group.id, userId: other }
    ] })

    thread = await prisma.directThread.create({ data: { groupId: group.id, userAId: a, userBId: b } })
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
    // Notifica todos os clientes que uma nova DM foi criada.
    // Clientes filtram pelo seu próprio userId.
    req.io?.emit('dm:created', {
      groupId: full.groupId,
      userA: { id: full.userA.id, name: full.userA.name, avatarUrl: full.userA.avatarUrl },
      userB: { id: full.userB.id, name: full.userB.name, avatarUrl: full.userB.avatarUrl },
      createdAt: full.group?.createdAt || new Date().toISOString(),
    })
  } catch {}
  res.status(201).json({ groupId: full.groupId, other: otherUser })
})

export default router
