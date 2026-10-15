// Limitador simples em memória (janela fixa) por IP + rota.
// Suficiente para uma única instância do servidor.
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, message = 'Muitas tentativas. Tente novamente mais tarde.' } = {}) {
  const hits = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const key = `${req.ip}|${req.baseUrl}${req.path}`
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)))
      return res.status(429).json({ error: message })
    }
    next()
  }
}
