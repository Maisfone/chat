const KEY = 'chat_auth'

// Avisa o app (ex.: socket) que o usuário logado mudou
function notifyAuthChanged() {
  try { window.dispatchEvent(new Event('chat:auth-changed')) } catch {}
}

export function setAuth(token, user) {
  const previous = getToken()
  localStorage.setItem(KEY, JSON.stringify({ token, user }))
  if (previous !== token) notifyAuthChanged()
}

export function getToken() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw).token } catch { return null }
}

export function getUser() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw).user } catch { return null }
}

export function clearAuth() {
  const hadToken = !!getToken()
  localStorage.removeItem(KEY)
  if (hadToken) notifyAuthChanged()
}
