import express from 'express'
import { prisma } from '../prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { handleUploadSingle } from '../lib/storage.js'

const router = express.Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

// Upload de avatar (local ou S3)
const upload = handleUploadSingle('avatar')

router.post('/register', upload, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return res.status(409).json({ error: 'E-mail jÃ¡ cadastrado' })
    const hash = await bcrypt.hash(data.password, 10)
    let avatarUrl = null
    if (req.file?.url) {
      avatarUrl = req.file.url
    } else if (req.body.avatarUrl) {
      avatarUrl = String(req.body.avatarUrl)
    }
    const user = await prisma.user.create({ data: { name: data.name, email: data.email, password: hash, avatarUrl } })
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' })
    try {
      req.io?.emit('user:created', { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl })
    } catch {}
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl } })
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados invÃ¡lidos' })
    res.status(500).json({ error: 'Erro no registro' })
  }
})

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Credenciais invÃ¡lidas' })
    if (user.isBlocked) return res.status(403).json({ error: 'UsuÃ¡rio bloqueado. Contate o administrador.' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Credenciais invÃ¡lidas' })
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl } })
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Dados invÃ¡lidos' })
    res.status(500).json({ error: 'Erro no login' })
  }
})

export default router

