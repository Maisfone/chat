import express from 'express'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { adminRequired, authRequired } from '../middleware/auth.js'
import { handleUploadSingle } from '../lib/storage.js'

const router = express.Router()

router.use(authRequired)

// Listar grupos do usuário
router.get('/', async (req, res) => {
  const me = req.user.id
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: me } }, directThread: { is: null } },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      _count: { select: { members: true } },
      // Última mensagem (prévia na lista de conversas)
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, type: true, content: true, createdAt: true, authorId: true }
      }
    }
  })
  // Anexa contagem de não lidas
  // Duas consultas no total (em vez de duas por grupo)
  const groupIds = groups.map((g) => g.id)
  const [unreadRows, mentionRows] = groupIds.length
    ? await Promise.all([
        prisma.message.groupBy({
          by: ['groupId'],
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            authorId: { not: me },
            reads: { none: { userId: me } }
          },
          _count: { _all: true }
        }),
        prisma.messageMention.findMany({
          where: {
            userId: me,
            message: {
              groupId: { in: groupIds },
              deletedAt: null,
              reads: { none: { userId: me } }
            }
          },
          select: { message: { select: { groupId: true } } }
        })
      ])
    : [[], []]
  const unreadMap = new Map(unreadRows.map((r) => [r.groupId, r._count._all]))
  const mentionMap = new Map()
  for (const row of mentionRows) {
    const gid = row.message?.groupId
    if (gid) mentionMap.set(gid, (mentionMap.get(gid) || 0) + 1)
  }
  res.json(groups.map(({ _count, messages, ...g }) => ({ ...g, lastMessage: messages?.[0] || null, _memberCount: _count?.members || 0, _unread: unreadMap.get(g.id) || 0, _mentions: mentionMap.get(g.id) || 0 })))
})

// Admin: listar todos os grupos
router.get('/all', adminRequired, async (req, res) => {
  const includeDMs = String(req.query.includeDMs || 'false').toLowerCase() === 'true'

  const groups = await prisma.group.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: { directThread: true }
  })

  const filtered = includeDMs ? groups : groups.filter((g) => !g.directThread)
  res.json(filtered.map(({ directThread, ...g }) => g))
})

// Participantes de um grupo (visível aos membros)
router.get('/:groupId/participants', async (req, res) => {
  const { groupId } = req.params
  const me = req.user.id
  // Verifica se o solicitante participa do grupo
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: me } })
  if (!member) return res.status(403).json({ error: 'Acesso negado' })
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' }
  })
  res.json(members.map(m => ({ id: m.id, groupId: m.groupId, userId: m.userId, role: m.role, joinedAt: m.joinedAt, user: m.user })))
})

// Admin: criar grupo
router.post('/', adminRequired, async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2), isPrivate: z.coerce.boolean().optional() })
  try {
    const { name, isPrivate } = schema.parse(req.body)
    const group = await prisma.group.create({ data: { name, isPrivate: !!isPrivate } })
    res.status(201).json(group)
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Admin: gerenciar membros
router.post('/:groupId/members', adminRequired, async (req, res) => {
  const schema = z.object({ userId: z.string().uuid(), role: z.string().optional() })
  try {
    const { userId, role } = schema.parse(req.body)
    const groupId = req.params.groupId
    const member = await prisma.groupMember.create({ data: { groupId, userId, role: role || 'member' } })
    // Conexões abertas do usuário passam a receber o grupo em tempo real
    try { req.io?.in(`user:${userId}`).socketsJoin(groupId) } catch {}
    res.status(201).json(member)
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos ou membro já existe' })
  }
})

router.delete('/:groupId/members/:userId', adminRequired, async (req, res) => {
  const { groupId, userId } = req.params
  try {
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
    // Removido do grupo deixa de receber as mensagens em tempo real
    try { req.io?.in(`user:${userId}`).socketsLeave(groupId) } catch {}
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Membro não encontrado' })
  }
})

// Admin: listar membros de um grupo
router.get('/:groupId/members', adminRequired, async (req, res) => {
  const { groupId } = req.params
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' }
  })
  res.json(members.map(m => ({ id: m.id, groupId: m.groupId, userId: m.userId, role: m.role, joinedAt: m.joinedAt, user: m.user })))
})

// Admin: atualizar grupo (nome, privado)
router.patch('/:groupId', adminRequired, async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).optional(), isPrivate: z.coerce.boolean().optional() })
  try {
    const data = schema.parse(req.body)
    const g = await prisma.group.update({ where: { id: req.params.groupId }, data })
    res.json(g)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao atualizar grupo' })
  }
})

// Atualizar avatar do grupo (local ou S3)
const upload = handleUploadSingle('avatar', { accept: 'image' })
router.patch('/:groupId/avatar', adminRequired, upload, async (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const g = await prisma.group.update({ where: { id: req.params.groupId }, data: { avatarUrl: req.file.url } })
    res.json({ ok: true, group: g })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao salvar avatar' })
  }
})

// Admin: excluir grupo e dependências
router.delete('/:groupId', adminRequired, async (req, res) => {
  const groupId = req.params.groupId
  try {
    await prisma.$transaction(async (tx) => {
      const msgs = await tx.message.findMany({ where: { groupId }, select: { id: true } })
      const ids = msgs.map(m => m.id)
      if (ids.length) {
        await tx.messageMention.deleteMany({ where: { messageId: { in: ids } } })
        await tx.messageRead.deleteMany({ where: { messageId: { in: ids } } })
        await tx.messageFavorite.deleteMany({ where: { messageId: { in: ids } } })
        await tx.messageReaction.deleteMany({ where: { messageId: { in: ids } } })
        await tx.message.updateMany({ where: { replyToId: { in: ids } }, data: { replyToId: null } })
        await tx.message.deleteMany({ where: { id: { in: ids } } })
      }
      await tx.groupMember.deleteMany({ where: { groupId } })
      try { await tx.directThread.deleteMany({ where: { groupId } }) } catch {}
      await tx.group.delete({ where: { id: groupId } })
    })
    res.status(204).send()
  } catch (e) {
    res.status(400).json({ error: 'Falha ao excluir grupo' })
  }
})

export default router
