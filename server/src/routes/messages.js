import express from 'express'
import { handleUploadSingle } from '../lib/storage.js'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { sendToUsers } from '../lib/push.js'

const router = express.Router()
router.use(authRequired)

function normalizeMentionText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function extractMentionTokens(content) {
  if (!content) return []
  const tokens = new Set()
  const re = /@([^\s@]{1,32})/g
  let match
  while ((match = re.exec(content))) {
    const raw = match[1] || ''
    const cleaned = raw.replace(/[.,!?;:]+$/g, '')
    const normalized = normalizeMentionText(cleaned)
    if (normalized) tokens.add(normalized)
  }
  return Array.from(tokens)
}

async function resolveMentionUserIds({ groupId, authorId, content }) {
  const tokens = extractMentionTokens(content)
  if (!tokens.length) return []
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } }
  })
  const ids = new Set()
  for (const m of members) {
    const nameNorm = normalizeMentionText(m.user?.name || '')
    if (!nameNorm) continue
    const parts = nameNorm.split(/\s+/).filter(Boolean)
    for (const token of tokens) {
      if (nameNorm.startsWith(token) || parts.some(p => p.startsWith(token))) {
        if (m.user?.id && m.user.id !== authorId) ids.add(m.user.id)
      }
    }
  }
  return Array.from(ids)
}

function buildReactionSummary(records = [], viewerId) {
  const map = new Map()
  for (const record of records || []) {
    const emoji = record?.emoji
    if (!emoji) continue
    const existing = map.get(emoji) || { emoji, count: 0, reactedByMe: false }
    existing.count += 1
    if (viewerId && record.userId === viewerId) existing.reactedByMe = true
    map.set(emoji, existing)
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return (a.emoji || '').localeCompare(b.emoji || '')
  })
}

function attachReactionSummary(message, viewerId) {
  if (!message) return message
  const { reactions, ...rest } = message
  return {
    ...rest,
    reactionSummary: buildReactionSummary(reactions, viewerId)
  }
}

// Upload de arquivo (local ou S3)
const upload = handleUploadSingle('file')

// Listar favoritos do usuário atual (opcional por groupId)
router.get('/favorites', async (req, res) => {
  try {
    const groupId = req.query.groupId
    const favs = await prisma.messageFavorite.findMany({
      where: groupId ? { userId: req.user.id, message: { groupId } } : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          select: {
            id: true, groupId: true, type: true, content: true, createdAt: true,
            author: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    })
    res.json(favs)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao listar favoritos' })
  }
})

export default router

// Listar mensagens de um grupo (paginação simples)
router.get('/:groupId', async (req, res) => {
  const { groupId } = req.params
  const take = Math.min(parseInt(req.query.take || '50', 10), 100)
  const cursor = req.query.cursor
  const where = { groupId }
  const messages = await prisma.message.findMany({
    where,
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      mentions: { select: { userId: true } },
      replyTo: {
        select: {
          id: true,
          type: true,
          content: true,
          author: { select: { id: true, name: true } }
        }
      },
      _count: { select: { replies: true } },
      reads: { select: { userId: true } },
      reactions: { select: { emoji: true, userId: true } }
    }
  })
  res.json(messages.map((m) => attachReactionSummary(m, req.user.id)))
})

// Enviar mensagem (texto ou URL)
router.post('/:groupId', async (req, res) => {
  const { groupId } = req.params
  const schema = z.object({
    type: z.enum(['text','gif','sticker','image','audio']).default('text'),
    content: z.string().min(1),
    replyToId: z.string().uuid().optional().nullable()
  })
  try {
    const { type, content, replyToId } = schema.parse(req.body)
    // valida se usuário é membro do grupo
    const member = await prisma.groupMember.findFirst({ where: { groupId, userId: req.user.id } })
    if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
    const mentionIds = type === 'text'
      ? await resolveMentionUserIds({ groupId, authorId: req.user.id, content })
      : []
    const msg = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { groupId, authorId: req.user.id, type, content, replyToId: replyToId || null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
          reactions: { select: { emoji: true, userId: true } }
        }
      })
      if (mentionIds.length) {
        await tx.messageMention.createMany({
          data: mentionIds.map(userId => ({ messageId: created.id, userId })),
          skipDuplicates: true
        })
      }
      await tx.group.update({ where: { id: groupId }, data: { lastMessageAt: created.createdAt } })
      const full = await tx.message.findUnique({
        where: { id: created.id },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
          mentions: { select: { userId: true } },
          reactions: { select: { emoji: true, userId: true } }
        }
      })
      return full || created
    })
    const normalizedMsg = attachReactionSummary(msg, req.user.id)
    req.io.to(groupId).emit('message:new', normalizedMsg)
    const pushNotifications = async () => {
      try {
        const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
        const targets = members.map((m) => m.userId).filter((id) => id !== req.user.id)
        const preview = normalizedMsg.type === 'text'
          ? normalizedMsg.content
          : (normalizedMsg.type === 'image' ? 'Imagem' : normalizedMsg.type === 'audio' ? 'Áudio' : 'Anexo')
        const mentionSet = new Set(mentionIds || [])
        const mentionTargets = targets.filter((id) => mentionSet.has(id))
        const otherTargets = targets.filter((id) => !mentionSet.has(id))
        if (mentionTargets.length) {
          await sendToUsers(mentionTargets, {
            title: normalizedMsg.author?.name || 'Mensagem',
            body: 'Você foi mencionado',
            tag: `group:${groupId}:mention`,
            data: { groupId, mention: true }
          })
        }
        if (otherTargets.length) {
          await sendToUsers(otherTargets, {
            title: normalizedMsg.author?.name || 'Mensagem',
            body: preview,
            tag: `group:${groupId}`,
            data: { groupId }
          })
        }
      } catch (error) {
        console.error('Push notification error', error)
      }
    }
    void pushNotifications()
    res.status(201).json(normalizedMsg)
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Upload de áudio/imagem
router.post('/:groupId/upload', upload, async (req, res) => {
  const { groupId } = req.params
  const kind = (req.query.type || 'audio')
  if (!['audio', 'image', 'file'].includes(kind)) return res.status(400).json({ error: 'Tipo inválido' })
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: req.user.id } })
  if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
  const url = req.file?.url
  if (!url) return res.status(400).json({ error: 'Falha no upload' })
  // Preserve original file name in the URL as a query param for display purposes
  let contentUrl = url
  try {
    const original = req.file?.originalname || ''
    if (original) {
      const hasQuery = /\?/.test(url)
      const sep = hasQuery ? '&' : '?'
      contentUrl = `${url}${sep}name=${encodeURIComponent(original)}`
    }
  } catch {}
  const replyToId = typeof req.query.replyToId === 'string' ? req.query.replyToId : null
  const storedType = kind === 'file' ? 'sticker' : kind
  const msg = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { groupId, authorId: req.user.id, type: storedType, content: contentUrl, replyToId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
        reactions: { select: { emoji: true, userId: true } }
      }
    })
    await tx.group.update({ where: { id: groupId }, data: { lastMessageAt: created.createdAt } })
    const full = await tx.message.findUnique({
      where: { id: created.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
        mentions: { select: { userId: true } },
        reactions: { select: { emoji: true, userId: true } }
      }
    })
    return full || created
  })
  const normalizedMsg = attachReactionSummary(msg, req.user.id)
  req.io.to(groupId).emit('message:new', normalizedMsg)
  const pushNotifications = async () => {
    try {
      const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
      const targets = members.map((m) => m.userId).filter((id) => id !== req.user.id)
      const body = kind === 'image' ? 'Imagem' : (kind === 'audio' ? 'Áudio' : 'Anexo')
      await sendToUsers(targets, {
        title: normalizedMsg.author?.name || 'Mensagem',
        body,
        tag: `group:${groupId}`,
        data: { groupId }
      })
    } catch (error) {
      console.error('Push notification error', error)
    }
  }
  void pushNotifications()
  res.status(201).json(normalizedMsg)
})

// Marcar mensagens do grupo como lidas para o usuário atual
router.post('/:groupId/read', async (req, res) => {
  const { groupId } = req.params
  const me = req.user.id
  // valida membro
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: me } })
  if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
  const unread = await prisma.message.findMany({
    where: { groupId, deletedAt: null, authorId: { not: me }, reads: { none: { userId: me } } },
    select: { id: true }
  })
  if (unread.length === 0) return res.json({ ok: true, marked: 0 })
  await prisma.messageRead.createMany({
    data: unread.map(u => ({ messageId: u.id, userId: me })),
    skipDuplicates: true
  })
  try { req.io.to(groupId).emit('messages:read', { groupId, userId: me, ids: unread.map(u => u.id) }) } catch {}
  res.json({ ok: true, marked: unread.length })
})
// Editar mensagem (somente texto) pelo autor ou admin
router.patch('/:messageId', async (req, res) => {
  const { messageId } = req.params
  try {
    const schema = z.object({ content: z.string().min(1) })
    const { content } = schema.parse(req.body)
    const msg = await prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' })
    const isAdmin = !!req.user?.isAdmin
    if (!isAdmin && msg.authorId !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })
    if (msg.type !== 'text') return res.status(400).json({ error: 'Apenas mensagens de texto podem ser editadas' })
    const mentionIds = await resolveMentionUserIds({
      groupId: msg.groupId,
      authorId: msg.authorId,
      content
    })
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.message.update({
        where: { id: messageId },
        data: { content, editedAt: new Date() },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
          reactions: { select: { emoji: true, userId: true } }
        }
      })
      await tx.messageMention.deleteMany({ where: { messageId } })
      if (mentionIds.length) {
        await tx.messageMention.createMany({
          data: mentionIds.map(userId => ({ messageId, userId })),
          skipDuplicates: true
        })
      }
      const full = await tx.message.findUnique({
        where: { id: messageId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } },
          mentions: { select: { userId: true } },
          reactions: { select: { emoji: true, userId: true } }
        }
      })
      return full || next
    })
    const normalizedUpdated = attachReactionSummary(updated, req.user.id)
    try { req.io.to(normalizedUpdated.groupId).emit('message:updated', normalizedUpdated) } catch {}
    res.json(normalizedUpdated)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao editar mensagem' })
  }
})

router.put('/:messageId/reaction', async (req, res) => {
  const { messageId } = req.params
  try {
    const schema = z.object({ emoji: z.string().trim().min(1).max(12) })
    const { emoji } = schema.parse(req.body)
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, groupId: true }
    })
    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada' })
    const member = await prisma.groupMember.findFirst({
      where: { groupId: message.groupId, userId: req.user.id }
    })
    if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
    const reactions = await prisma.$transaction(async (tx) => {
      const existing = await tx.messageReaction.findUnique({
        where: { messageId_userId: { messageId, userId: req.user.id } },
        select: { id: true, emoji: true }
      })
      if (existing) {
        if (existing.emoji === emoji) {
          await tx.messageReaction.delete({ where: { id: existing.id } })
        } else {
          await tx.messageReaction.update({
            where: { id: existing.id },
            data: { emoji }
          })
        }
      } else {
        await tx.messageReaction.create({
          data: { messageId, userId: req.user.id, emoji }
        })
      }
      return tx.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true }
      })
    })
    const summary = buildReactionSummary(reactions, req.user.id)
    const payload = { messageId, groupId: message.groupId, summary }
    try { req.io.to(message.groupId).emit('message.reaction.updated', payload) } catch {}
    res.json(payload)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao reagir à mensagem' })
  }
})
// Apagar (soft-delete) mensagem do autor (ou admin)
router.delete('/:messageId', async (req, res) => {
  const { messageId } = req.params
  const msg = await prisma.message.findUnique({ where: { id: messageId } })
  if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' })
  // Verifica permissão: autor ou admin em qualquer grupo
  const isAdmin = req.user?.isAdmin
  if (!isAdmin && msg.authorId !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } }
  })
  // Emite evento para sala do grupo
  req.io.to(msg.groupId).emit('message:deleted', { id: updated.id, groupId: msg.groupId, deletedAt: updated.deletedAt })
  res.json({ ok: true, id: updated.id })
})

// Favoritar mensagem
router.post('/:messageId/favorite', async (req, res) => {
  const { messageId } = req.params
  try {
    const msg = await prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' })
    // verify user is member of the group
    const isMember = await prisma.groupMember.findFirst({ where: { groupId: msg.groupId, userId: req.user.id } })
    if (!isMember) return res.status(403).json({ error: 'Sem acesso ao grupo' })
    await prisma.messageFavorite.upsert({
      where: { messageId_userId: { messageId, userId: req.user.id } },
      update: {},
      create: { messageId, userId: req.user.id },
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao favoritar' })
  }
})

// Remover favorito
router.delete('/:messageId/favorite', async (req, res) => {
  const { messageId } = req.params
  try {
    await prisma.messageFavorite.delete({ where: { messageId_userId: { messageId, userId: req.user.id } } })
  } catch {}
  res.json({ ok: true })
})

// Listar favoritos do usuário atual (opcional por groupId)
router.get('/favorites', async (req, res) => {
  try {
    const groupId = req.query.groupId
    const favs = await prisma.messageFavorite.findMany({
      where: groupId ? { userId: req.user.id, message: { groupId } } : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          select: {
            id: true, groupId: true, type: true, content: true, createdAt: true,
            author: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    })
    res.json(favs)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao listar favoritos' })
  }
})
