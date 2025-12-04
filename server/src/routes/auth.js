import express from 'express'
import { prisma } from '../prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'
import { handleUploadSingle } from '../lib/storage.js'
import { sendMail } from '../lib/mailer.js'

const router = express.Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

// Upload de avatar (local ou S3)
const upload = handleUploadSingle('avatar')

router.post('/register', upload, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })
    const hash = await bcrypt.hash(data.password, 10)
    let avatarUrl = null
    if (req.file?.url) {
      avatarUrl = req.file.url
    } else if (req.body.avatarUrl) {
      avatarUrl = String(req.body.avatarUrl)
    }
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hash, avatarUrl },
    })
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    try {
      req.io?.emit('user:created', {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      })
    } catch {}
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro no registro' })
  }
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })
    if (user.isBlocked)
      return res
        .status(403)
        .json({ error: 'Usuário bloqueado. Contate o administrador.' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro no login' })
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json({
        message: 'Se o e-mail estiver cadastrado, enviaremos uma nova senha.',
      })
    }
    const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase()
    const hash = await bcrypt.hash(tempPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    })
    try {
      await sendMail({
        to: email,
        subject: 'Recuperação de senha - Farmacon Chat',
        text: `Olá ${user.name || ''}!

Sua nova senha temporária é: ${tempPassword}
Faça login e altere-a imediatamente em seu perfil.

Equipe Farmacon`,
        html: `<p>Olá <strong>${user.name || ''}</strong>!</p>
               <p>Sua nova senha temporária é: <strong>${tempPassword}</strong></p>
               <p>Faça login e altere-a imediatamente em seu perfil.</p>
               <p>Equipe Farmacon</p>`,
      })
    } catch (mailErr) {
      console.error('Erro ao enviar e-mail de recuperação', mailErr)
      return res
        .status(500)
        .json({ error: 'Não foi possível enviar o e-mail no momento.' })
    }
    res.json({
      message: 'Enviamos uma nova senha para o e-mail informado.',
    })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro ao recuperar senha' })
  }
})

export default router
