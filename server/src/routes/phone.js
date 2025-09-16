import express from 'express'
import { prisma } from '../prisma.js'
import { authRequired, adminRequired } from '../middleware/auth.js'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
router.use(authRequired)

// Obter configuração SIP do próprio usuário (sem senha)
router.get('/me', async (req, res) => {
  try {
    const acc = await prisma.sipAccount.findUnique({ where: { userId: req.user.id } })
    if (!acc) return res.json(null)
    // Retorna a senha apenas para o próprio usuário
    res.json({ domain: acc.domain, extension: acc.extension, password: acc.password || '', hasPassword: !!acc.password })
  } catch (e) {
    try { console.error('SIP /me get error:', e) } catch {}
    res.status(500).json({ error: 'Falha ao carregar SIP' })
  }
})

// Atualizar/criar configuração SIP do próprio usuário
router.patch('/me', async (req, res) => {
  const schema = z.object({
    domain: z.string().min(1),
    extension: z.string().min(1),
    password: z.string().min(1).optional().nullable()
  })
  try {
    const data = schema.parse(req.body)
    const existing = await prisma.sipAccount.findUnique({ where: { userId: req.user.id } })
    if (existing) {
      await prisma.sipAccount.update({ where: { userId: req.user.id }, data: { domain: data.domain, extension: data.extension, ...(data.password ? { password: data.password } : {}) } })
    } else {
      await prisma.sipAccount.create({ data: { id: uuidv4(), userId: req.user.id, domain: data.domain, extension: data.extension, password: data.password || '' } })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Atualiza status de registro (app-level heartbeat)
router.post('/me/status', async (req, res) => {
  const schema = z.object({
    registered: z.boolean(),
    status: z.string().optional().nullable()
  })
  try {
    const data = schema.parse(req.body)
    const now = new Date()
    const acc = await prisma.sipAccount.findUnique({ where: { userId: req.user.id } })
    if (!acc) return res.status(404).json({ error: 'Conta SIP não encontrada' })
    await prisma.sipAccount.update({
      where: { userId: req.user.id },
      data: { regRegistered: data.registered, regStatus: data.status || null, regUpdatedAt: now }
    })
    res.json({ ok: true, at: now })
  } catch (e) {
    res.status(400).json({ error: e?.message || 'Dados inválidos' })
  }
})

// Admin: listar contas SIP (sem senha)
router.get('/', adminRequired, async (req, res) => {
  const list = await prisma.sipAccount.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(list.map(a => ({
    id: a.id,
    user: a.user,
    domain: a.domain,
    extension: a.extension,
    hasPassword: !!a.password,
    createdAt: a.createdAt,
    regRegistered: a.regRegistered,
    regStatus: a.regStatus,
    regUpdatedAt: a.regUpdatedAt
  })))
})

// Admin: atualizar/criar conta SIP de um usuário
router.patch('/:userId', adminRequired, async (req, res) => {
  const schema = z.object({
    domain: z.string().min(1),
    extension: z.string().min(1),
    password: z.string().min(1).optional().nullable()
  })
  try {
    const data = schema.parse(req.body)
    const uid = req.params.userId
    const existing = await prisma.sipAccount.findUnique({ where: { userId: uid } })
    if (existing) {
      await prisma.sipAccount.update({ where: { userId: uid }, data: { domain: data.domain, extension: data.extension, ...(data.password ? { password: data.password } : {}) } })
    } else {
      await prisma.sipAccount.create({ data: { id: uuidv4(), userId: uid, domain: data.domain, extension: data.extension, password: data.password || '' } })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Dados inválidos' })
  }
})

// Admin: marcar ramal como desconectado (app-level)
router.post('/:userId/disconnect', adminRequired, async (req, res) => {
  try {
    const uid = req.params.userId
    const acc = await prisma.sipAccount.findUnique({ where: { userId: uid } })
    if (!acc) return res.status(404).json({ error: 'Conta SIP não encontrada' })
    const now = new Date()
    await prisma.sipAccount.update({ where: { userId: uid }, data: { regRegistered: false, regStatus: 'Desconectado pelo admin', regUpdatedAt: now } })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e?.message || 'Falha ao desconectar' })
  }
})

// Admin: excluir/remover conta SIP de um usuário
router.delete('/:userId', adminRequired, async (req, res) => {
  try {
    const uid = req.params.userId
    await prisma.sipAccount.delete({ where: { userId: uid } })
    res.status(204).send()
  } catch (e) {
    res.status(404).json({ error: 'Conta SIP não encontrada' })
  }
})

export default router
