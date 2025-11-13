const KEY = 'chat_auth'

export function setAuth(token, user) {
  localStorage.setItem(KEY, JSON.stringify({ token, user }))
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
  localStorage.removeItem(KEY)
}
