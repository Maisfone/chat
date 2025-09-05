import express from 'express'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { adminRequired, authRequired } from '../middleware/auth.js'

const router = express.Router()

router.use(authRequired)

// Listar grupos do usuário
router.get('/', async (req, res) => {
  const me = req.user.id
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: me } }, directThread: null },
    orderBy: { createdAt: 'desc' }
  })
  // Anexa contagem de não lidas
  const withUnread = await Promise.all(groups.map(async (g) => {
    const unread = await prisma.message.count({
      where: {
        groupId: g.id,
        deletedAt: null,
        authorId: { not: me },
        reads: { none: { userId: me } }
      }
    })
    return { ...g, _unread: unread }
  }))
  res.json(withUnread)
})

// Admin: listar todos os grupos
router.get('/all', adminRequired, async (req, res) => {
  const includeDMs = String(req.query.includeDMs || 'false').toLowerCase() === 'true'
  const groups = await prisma.group.findMany({
    where: includeDMs ? {} : { directThread: null },
    orderBy: { createdAt: 'desc' }
  })
  res.json(groups)
})

// Admin: criar grupo
router.post('/', adminRequired, async (req, res) => {
  const schema = z.object({ name: z.string().min(2), isPrivate: z.boolean().optional() })
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
    res.status(201).json(member)
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos ou membro já existe' })
  }
})

router.delete('/:groupId/members/:userId', adminRequired, async (req, res) => {
  const { groupId, userId } = req.params
  try {
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
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
  const schema = z.object({ name: z.string().min(2).optional(), isPrivate: z.boolean().optional() })
  try {
    const data = schema.parse(req.body)
    const g = await prisma.group.update({ where: { id: req.params.groupId }, data })
    res.json(g)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao atualizar grupo' })
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
        await tx.messageRead.deleteMany({ where: { messageId: { in: ids } } })
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
