// No Express 4, um erro dentro de uma rota async não chega ao handler de erros
// e a requisição fica pendurada. Este patch encaminha promessas rejeitadas para next(err).
import Layer from 'express/lib/router/layer.js'

Layer.prototype.handle_request = function handleRequestWithAsync(req, res, next) {
  const fn = this.handle
  if (fn.length > 3) return next()
  try {
    const result = fn(req, res, next)
    if (result && typeof result.catch === 'function') result.catch(next)
  } catch (err) {
    next(err)
  }
}
