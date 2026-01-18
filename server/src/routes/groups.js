import express from 'express'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { adminRequired, authRequired } from '../middleware/auth.js'
import { handleUploadSingle } from '../lib/storage.js'

const router = express.Router()

router.use(authRequired)

// Listar grupos do usuÃ¡rio
router.get('/', async (req, res) => {
  const me = req.user.id
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: me } }, directThread: { is: null } },
    orderBy: { lastMessageAt: 'desc' }
  })
  // Anexa contagem de nÃ£o lidas
  const withUnread = await Promise.all(groups.map(async (g) => {
    const unread = await prisma.message.count({
      where: {
        groupId: g.id,
        deletedAt: null,
        authorId: { not: me },
        reads: { none: { userId: me } }
      }
    })
    const mentions = await prisma.messageMention.count({
      where: {
        userId: me,
        message: {
          groupId: g.id,
          deletedAt: null,
          reads: { none: { userId: me } }
        }
      }
    })
    return { ...g, _unread: unread, _mentions: mentions }
  }))
  res.json(withUnread)
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
    res.status(400).json({ error: 'Dados invÃ¡lidos' })
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
    res.status(400).json({ error: 'Dados invÃ¡lidos ou membro jÃ¡ existe' })
  }
})

router.delete('/:groupId/members/:userId', adminRequired, async (req, res) => {
  const { groupId, userId } = req.params
  try {
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Membro nÃ£o encontrado' })
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
const upload = handleUploadSingle('avatar')
router.patch('/:groupId/avatar', adminRequired, upload, async (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const g = await prisma.group.update({ where: { id: req.params.groupId }, data: { avatarUrl: req.file.url } })
    res.json({ ok: true, group: g })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao salvar avatar' })
  }
})

// Admin: excluir grupo e dependÃªncias
router.delete('/:groupId', adminRequired, async (req, res) => {
  const groupId = req.params.groupId
  try {
    await prisma.$transaction(async (tx) => {
      const msgs = await tx.message.findMany({ where: { groupId }, select: { id: true } })
      const ids = msgs.map(m => m.id)
      if (ids.length) {
        await tx.messageMention.deleteMany({ where: { messageId: { in: ids } } })
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
