import jwt from 'jsonwebtoken'
import { prisma } from '../prisma.js'

// Cache curto do estado do usuário (bloqueio/admin) para não consultar o banco a cada requisição
const CACHE_TTL_MS = 15 * 1000
const userCache = new Map()

export function invalidateUserCache(userId) {
  if (userId) userCache.delete(userId)
}

async function loadUserState(userId) {
  const cached = userCache.get(userId)
  if (cached && cached.expires > Date.now()) return cached.value
  const value = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isAdmin: true, isBlocked: true, passwordChangedAt: true },
  })
  userCache.set(userId, { value, expires: Date.now() + CACHE_TTL_MS })
  return value
}

// Valida o token e o estado atual do usuário no banco.
// Retorna o usuário (payload atualizado) ou lança erro com .status
export async function verifyToken(token) {
  if (!token) {
    const err = new Error('Token ausente')
    err.status = 401
    throw err
  }
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    const err = new Error('Token inválido')
    err.status = 401
    throw err
  }
  const user = payload?.id ? await loadUserState(payload.id) : null
  if (!user) {
    const err = new Error('Usuário não encontrado')
    err.status = 401
    throw err
  }
  if (user.isBlocked) {
    const err = new Error('Usuário bloqueado')
    err.status = 401
    throw err
  }
  // Tokens emitidos antes da última troca de senha deixam de valer
  if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    const err = new Error('Sessão expirada')
    err.status = 401
    throw err
  }
  return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }
}

export async function authRequired(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  try {
    req.user = await verifyToken(token)
    next()
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: e.message })
    next(e)
  }
}

export function adminRequired(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin requerido' })
  next()
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}
