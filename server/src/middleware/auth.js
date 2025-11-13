import jwt from 'jsonwebtoken'

export function authRequired(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

export function adminRequired(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin requerido' })
  next()
}
