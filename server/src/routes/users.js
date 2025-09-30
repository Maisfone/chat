import express from 'express'
import { prisma } from '../prisma.js'
import { adminRequired, authRequired } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { handleUploadSingle } from '../lib/storage.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const router = express.Router()

router.use(authRequired)

// Perfil próprio
router.get('/me', async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, isAdmin: true, avatarUrl: true, phone: true, address: true } })
  res.json(me)
})

// Grupos em comum com outro usuário (autenticado)
router.get('/:id/shared-groups', async (req, res) => {
  const otherId = req.params.id
  const me = req.user.id
  if (otherId === me) return res.json([])
  const groups = await prisma.group.findMany({
    where: {
      AND: [
        { members: { some: { userId: me } } },
        { members: { some: { userId: otherId } } },
      ]
    },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  })
  res.json(groups)
})

// Admin: grupos que um usuário participa
router.get('/:id/groups', adminRequired, async (req, res) => {
  const { id } = req.params
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: id } } },
    select: { id: true, name: true }
  })
  res.json(groups)
})

// Upload config para avatar do próprio usuário
const uploadDir = process.env.UPLOAD_DIR || 'uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})
const upload = multer({ storage })

// Atualizar perfil próprio (nome, telefone, endereço, avatar)
router.patch('/me', ...(Array.isArray(handleUploadSingle('avatar')) ? handleUploadSingle('avatar') : [handleUploadSingle('avatar')]), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  })
  try {
    const data = schema.parse(req.body)
    const avatarUrl = req.file?.url
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { ...data, ...(avatarUrl ? { avatarUrl } : {}) }, select: { id: true, name: true, email: true, isAdmin: true, avatarUrl: true, phone: true, address: true } })
    res.json({ ok: true, user })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao atualizar perfil' })
  }
})

// Alterar senha própria (com senha atual)
router.post('/me/password', async (req, res) => {
  const schema = z.object({ current: z.string().min(1), password: z.string().min(6) })
  try {
    const { current, password } = schema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const ok = await bcrypt.compare(current, user.password)
    if (!ok) return res.status(401).json({ error: 'Senha atual inválida' })
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao alterar senha' })
  }
})

// Lista pública (autenticado) para iniciar DMs
router.get('/all', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { NOT: { id: req.user.id } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true }
  })
  res.json(users)
})

// Admin: listar usuários
router.get('/', adminRequired, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, isAdmin: true, isBlocked: true, phone: true, address: true, avatarUrl: true, createdAt: true }
  })
  res.json(users)
})

// Admin: criar usuário
router.post('/', adminRequired, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    isAdmin: z.boolean().optional(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    isBlocked: z.boolean().optional()
  })
  try {
    const data = schema.parse(req.body)
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })
    const hash = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({ data: { name: data.name, email: data.email, password: hash, isAdmin: !!data.isAdmin, phone: data.phone || null, address: data.address || null, isBlocked: !!data.isBlocked } })
    try { req.io?.emit('user:created', { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl }) } catch {}
    res.status(201).json({ id: user.id })
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Editar dados de usuário
router.patch('/:id', adminRequired, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    isAdmin: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional()
  })
  try {
    const data = schema.parse(req.body)
    const user = await prisma.user.update({ where: { id: req.params.id }, data })
    try { req.io?.emit('user:updated', { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, isBlocked: user.isBlocked, isAdmin: user.isAdmin }) } catch {}
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao atualizar usuário' })
  }
})

// Alterar senha
router.post('/:id/password', adminRequired, async (req, res) => {
  const schema = z.object({ password: z.string().min(6) })
  try {
    const { password } = schema.parse(req.body)
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hash } })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Falha ao alterar senha' })
  }
})

// Excluir usuário (simples)
router.delete('/:id', adminRequired, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } })
    try { req.io?.emit('user:deleted', { id: req.params.id }) } catch {}
    res.status(204).send()
  } catch (e) {
    res.status(400).json({ error: 'Falha ao excluir usuário' })
  }
})

export default router

