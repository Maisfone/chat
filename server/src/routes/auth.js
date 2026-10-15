import express from 'express'
import { prisma } from '../prisma.js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { handleUploadSingle } from '../lib/storage.js'
import { sendMail } from '../lib/mailer.js'
import { rateLimit } from '../lib/rateLimit.js'
import { signToken, invalidateUserCache } from '../middleware/auth.js'

const router = express.Router()

const RESET_TTL_MS = 30 * 60 * 1000

const emailKey = (req) => String(req.body?.email || '').trim().toLowerCase()
const LOGIN_MSG = 'Muitas tentativas de login. Aguarde alguns minutos.'
// Só tentativas erradas contam: 10 por conta (IP + e-mail) e 50 por IP, a cada 15 min
const loginLimiterPerAccount = rateLimit({ max: 10, onlyFailures: true, message: LOGIN_MSG, keyFn: (req) => `login|${req.ip}|${emailKey(req)}` })
const loginLimiterPerIp = rateLimit({ max: 50, onlyFailures: true, message: LOGIN_MSG, keyFn: (req) => `login|${req.ip}` })
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 })
const forgotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyFn: (req) => `forgot|${emailKey(req)}` })
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, onlyFailures: true })

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
})

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// URL do frontend usada no link de redefinição. Nunca usar o header Origin/Host da
// requisição: um atacante poderia fazer o link (com o token) apontar para o site dele.
function appUrl() {
  const fromEnv = (process.env.APP_URL || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const cors = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (cors.length && cors[0] !== '*') return cors[0].replace(/\/$/, '')
  return null
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    avatarUrl: user.avatarUrl,
  }
}

// Upload de avatar (local ou S3)
const upload = handleUploadSingle('avatar', { accept: 'image' })

router.post('/register', registerLimiter, upload, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const exists = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } })
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })
    const hash = await bcrypt.hash(data.password, 10)
    let avatarUrl = null
    if (req.file?.url) {
      avatarUrl = req.file.url
    } else if (typeof req.body.avatarUrl === 'string' && /^https?:\/\//i.test(req.body.avatarUrl)) {
      avatarUrl = req.body.avatarUrl
    }
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hash, avatarUrl },
    })
    try {
      req.io?.emit('user:created', {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      })
    } catch {}
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro no registro' })
  }
})

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
})

router.post('/login', loginLimiterPerIp, loginLimiterPerAccount, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    // Confere a senha antes de revelar qualquer coisa sobre a conta
    const ok = user ? await bcrypt.compare(password, user.password) : false
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })
    if (user.isBlocked)
      return res
        .status(403)
        .json({ error: 'Usuário bloqueado. Contate o administrador.' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro no login' })
  }
})

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

const GENERIC_FORGOT_MESSAGE =
  'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.'

// Envia um link de uso único; a senha só muda quando o próprio dono do e-mail usa o link
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body)
    const base = appUrl()
    if (!base) {
      console.error('APP_URL não configurado: não é possível gerar link de redefinição de senha')
      return res.status(500).json({ error: 'Recuperação de senha não configurada no servidor.' })
    }
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    if (!user || user.isBlocked) {
      return res.json({ message: GENERIC_FORGOT_MESSAGE })
    }
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashResetToken(token),
        passwordResetExpires: new Date(Date.now() + RESET_TTL_MS),
      },
    })
    const link = `${base}/redefinir-senha?token=${token}`
    try {
      await sendMail({
        to: user.email,
        subject: 'Redefinição de senha - Farmacon Chat',
        text: `Olá ${user.name || ''}!

Recebemos um pedido para redefinir sua senha.
Para criar uma nova senha, acesse o link abaixo (válido por 30 minutos):

${link}

Se você não fez esse pedido, ignore este e-mail. Sua senha atual continua valendo.

Equipe Farmacon`,
        html: `<p>Olá <strong>${escapeHtml(user.name)}</strong>!</p>
               <p>Recebemos um pedido para redefinir sua senha.</p>
               <p><a href="${escapeHtml(link)}">Clique aqui para criar uma nova senha</a> (válido por 30 minutos).</p>
               <p>Se você não fez esse pedido, ignore este e-mail. Sua senha atual continua valendo.</p>
               <p>Equipe Farmacon</p>`,
      })
    } catch (mailErr) {
      console.error('Erro ao enviar e-mail de recuperação', mailErr)
      return res
        .status(500)
        .json({ error: 'Não foi possível enviar o e-mail no momento.' })
    }
    res.json({ message: GENERIC_FORGOT_MESSAGE })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Dados inválidos' })
    res.status(500).json({ error: 'Erro ao recuperar senha' })
  }
})

const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(6).max(200),
})

router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { passwordResetToken: hashResetToken(token) } })
    if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' })
    }
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hash,
        passwordChangedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })
    invalidateUserCache(user.id)
    res.json({ message: 'Senha alterada. Faça login com a nova senha.' })
  } catch (err) {
    if (err.name === 'ZodError')
      return res.status(400).json({ error: 'Link inválido ou senha muito curta (mínimo 6 caracteres).' })
    res.status(500).json({ error: 'Erro ao redefinir senha' })
  }
})

export default router
