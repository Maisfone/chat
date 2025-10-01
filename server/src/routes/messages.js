import express from 'express'
import { handleUploadSingle } from '../lib/storage.js'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { sendToUsers } from '../lib/push.js'

const router = express.Router()
router.use(authRequired)

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
      replyTo: {
        select: {
          id: true,
          type: true,
          content: true,
          author: { select: { id: true, name: true } }
        }
      },
      _count: { select: { replies: true } },
      reads: { select: { userId: true } }
    }
  })
  res.json(messages)
})

// Enviar mensagem (texto ou URL)
router.post('/:groupId', async (req, res) => {
  const { groupId } = req.params
  const schema = z.object({
    type: z.enum(['text','gif','sticker','image']).default('text'),
    content: z.string().min(1),
    replyToId: z.string().uuid().optional().nullable()
  })
  try {
    const { type, content, replyToId } = schema.parse(req.body)
    // valida se usuário é membro do grupo
    const member = await prisma.groupMember.findFirst({ where: { groupId, userId: req.user.id } })
    if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
    const msg = await prisma.message.create({
      data: { groupId, authorId: req.user.id, type, content, replyToId: replyToId || null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } }
      }
    })
    req.io.to(groupId).emit('message:new', msg)
    // Push para membros (exclui autor)
    try {
      const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
      const targets = members.map(m => m.userId).filter(id => id !== req.user.id)
      await sendToUsers(targets, { title: msg.author?.name || 'Mensagem', body: msg.type==='text'? msg.content : (msg.type==='image'?'Imagem': msg.type==='audio'?'Áudio':'Anexo'), tag: `group:${groupId}`, data: { groupId } })
    } catch {}
    res.status(201).json(msg)
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
  const msg = await prisma.message.create({
    data: { groupId, authorId: req.user.id, type: storedType, content: contentUrl, replyToId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } }
    }
  })
  req.io.to(groupId).emit('message:new', msg)
  try {
    const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
    const targets = members.map(m => m.userId).filter(id => id !== req.user.id)
    const body = kind==='image' ? 'Imagem' : (kind==='audio' ? 'Áudio' : 'Anexo')
    await sendToUsers(targets, { title: msg.author?.name || 'Mensagem', body, tag: `group:${groupId}`, data: { groupId } })
  } catch {}
  res.status(201).json(msg)
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
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } }
      }
    })
    try { req.io.to(updated.groupId).emit('message:updated', updated) } catch {}
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: 'Falha ao editar mensagem' })
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

export default router
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
