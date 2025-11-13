import express from 'express'
import { prisma } from '../prisma.js'
import { authRequired } from '../middleware/auth.js'
import { z } from 'zod'

const router = express.Router()

function genCode(len = 8) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}
function genToken(len = 32) {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

function ensurePrisma(res) {
  const ok = Boolean(prisma?.meeting && prisma?.meetingParticipant)
  if (!ok && res) {
    res.status(500).json({
      error: 'Prisma não gerado para Meetings.',
      hint: 'Dentro de server/: npx prisma generate && npx prisma migrate dev, depois reinicie o servidor.'
    })
  }
  return ok
}

// Health (public): verify prisma models and DB connectivity
router.get('/health', async (req, res) => {
  const hasModels = Boolean(prisma?.meeting && prisma?.meetingParticipant)
  let db = 'unknown'
  try { await prisma.$queryRaw`SELECT 1`; db = 'ok' } catch { db = 'error' }
  res.json({ ok: hasModels && db === 'ok', hasModels, db })
})

// Public invite lookup by token (no auth)
router.get('/invite/:token', async (req, res) => {
  if (!ensurePrisma(res)) return
  const token = req.params.token
  const part = await prisma.meetingParticipant.findFirst({ where: { inviteToken: token }, include: { meeting: true } })
  if (!part) return res.status(404).json({ error: 'Convite inválido' })
  res.json({ meeting: { id: part.meetingId, code: part.meeting.code, title: part.meeting.title, scheduledStart: part.meeting.scheduledStart, isInstant: part.meeting.isInstant }, participant: { id: part.id, name: part.name, email: part.email } })
})

// Auth for the rest of endpoints
router.use(authRequired)

// List meetings for the current user (host or participant)
router.get('/', async (req, res) => {
  if (!ensurePrisma(res)) return
  const me = req.user.id
  const list = await prisma.meeting.findMany({
    where: {
      OR: [
        { hostId: me },
        { participants: { some: { userId: me } } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, code: true, title: true, description: true, isInstant: true,
      scheduledStart: true, scheduledEnd: true, createdAt: true,
      host: { select: { id: true, name: true, email: true } },
      _count: { select: { participants: true } }
    }
  })
  res.json(list)
})

// Create meeting (instant or scheduled)
router.post('/', async (req, res) => {
  if (!ensurePrisma(res)) return
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional().nullable(),
    isInstant: z.boolean().optional().default(false),
    scheduledStart: z.string().datetime().optional().nullable(),
    scheduledEnd: z.string().datetime().optional().nullable(),
    participants: z.array(z.object({ email: z.string().email(), name: z.string().optional().nullable() })).optional().default([])
  })
  try {
    const data = schema.parse(req.body)
    // Attempt create and retry on unique code collision without findUnique
    let created
    for (let i = 0; i < 5; i++) {
      const code = genCode(8)
      try {
        created = await prisma.meeting.create({
          data: {
            code,
            title: data.title,
            description: data.description || null,
            hostId: req.user.id,
            isInstant: !!data.isInstant,
            scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
            scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
            participants: {
              create: (data.participants || []).map(p => ({ email: p.email, name: p.name || null, inviteToken: genToken(36) }))
            }
          },
          select: {
            id: true, code: true, title: true, description: true, isInstant: true, scheduledStart: true, scheduledEnd: true,
            participants: { select: { id: true, email: true, name: true, inviteToken: true } }
          }
        })
        break
      } catch (e) {
        if (e?.code === 'P2002') continue
        throw e
      }
    }
    if (!created) throw new Error('Falha ao gerar código único para reunião')
    res.status(201).json(created)
  } catch (e) {
    console.error('Create meeting error:', e)
    res.status(400).json({ error: e?.message || 'Dados inválidos' })
  }
})

// Get meeting details
router.get('/:id', async (req, res) => {
  if (!ensurePrisma(res)) return
  const me = req.user.id
  const id = req.params.id
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { participants: true, host: { select: { id: true, name: true, email: true } } }
  })
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' })
  // visibility: host or participant by userId
  const canSee = meeting.hostId === me || meeting.participants.some(p => p.userId === me)
  if (!canSee) return res.status(403).json({ error: 'Sem acesso' })
  res.json(meeting)
})

// Add participants (emails)
router.post('/:id/participants', async (req, res) => {
  if (!ensurePrisma(res)) return
  const id = req.params.id
  const me = req.user.id
  const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true, hostId: true } })
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' })
  if (meeting.hostId !== me) return res.status(403).json({ error: 'Somente o anfitrião pode convidar' })
  const schema = z.object({
    participants: z.array(z.object({ email: z.string().email(), name: z.string().optional().nullable() })).min(1)
  })
  try {
    const data = schema.parse(req.body)
    const created = await prisma.meetingParticipant.createMany({
      data: data.participants.map(p => ({ meetingId: id, email: p.email, name: p.name || null, inviteToken: genToken(36), role: 'guest', status: 'invited' })),
      skipDuplicates: true
    })
    res.json({ ok: true, added: created.count })
  } catch (e) {
    console.error('Add participants error:', e)
    res.status(400).json({ error: e?.message || 'Dados inválidos' })
  }
})

export default router
