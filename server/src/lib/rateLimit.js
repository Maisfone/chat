// Limitador simples em memória (janela fixa). Suficiente para uma única instância do servidor.
// - keyFn: define o que é contado junto (padrão: IP + rota)
// - onlyFailures: só conta respostas com erro (>= 400), para não travar vários
//   usuários legítimos que saem pelo mesmo IP (ex.: rede da empresa)
export function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'Muitas tentativas. Tente novamente mais tarde.',
  keyFn = (req) => `${req.ip}|${req.baseUrl}${req.path}`,
  onlyFailures = false,
} = {}) {
  const hits = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key)
    }
  }, windowMs).unref()

  function entryFor(key) {
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(key, entry)
    }
    return entry
  }

  return (req, res, next) => {
    const key = keyFn(req)
    const entry = entryFor(key)
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - Date.now()) / 1000)))
      return res.status(429).json({ error: message })
    }
    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode >= 400) entryFor(key).count += 1
      })
    } else {
      entry.count += 1
    }
    next()
  }
}
