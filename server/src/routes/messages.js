import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../prisma.js'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()
router.use(authRequired)

const uploadDir = process.env.UPLOAD_DIR || 'uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, fname)
  }
})
const upload = multer({ storage })

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
      _count: { select: { replies: true } }
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
    res.status(201).json(msg)
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Upload de áudio/imagem
router.post('/:groupId/upload', upload.single('file'), async (req, res) => {
  const { groupId } = req.params
  const kind = (req.query.type || 'audio')
  if (!['audio', 'image'].includes(kind)) return res.status(400).json({ error: 'Tipo inválido' })
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: req.user.id } })
  if (!member) return res.status(403).json({ error: 'Sem acesso ao grupo' })
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
  const url = `${base}/${uploadDir}/${req.file.filename}`
  const replyToId = typeof req.query.replyToId === 'string' ? req.query.replyToId : null
  const msg = await prisma.message.create({
    data: { groupId, authorId: req.user.id, type: kind, content: url, replyToId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: { select: { id: true, type: true, content: true, author: { select: { id: true, name: true } } } }
    }
  })
  req.io.to(groupId).emit('message:new', msg)
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
    where: { groupId, deletedAt: null, reads: { none: { userId: me } } },
    select: { id: true }
  })
  if (unread.length === 0) return res.json({ ok: true, marked: 0 })
  await prisma.messageRead.createMany({
    data: unread.map(u => ({ messageId: u.id, userId: me })),
    skipDuplicates: true
  })
  res.json({ ok: true, marked: unread.length })
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
