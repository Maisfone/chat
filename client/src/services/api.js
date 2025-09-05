import { getToken } from '../state/auth.js'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
export const apiOrigin = API_BASE.replace(/\/?api$/, '')

async function handle(res) {
  if (!res.ok) {
    const t = await res.text()
    let msg
    try { msg = JSON.parse(t).error || t } catch { msg = t }
    throw new Error(msg || 'Erro de requisição')
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

export const api = {
  get: (path) => fetch(`${API_BASE}${path}`, { headers: { 'Authorization': `Bearer ${getToken()}` } }).then(handle),
  post: (path, body) => fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(body) }).then(handle),
  patch: (path, body) => fetch(`${API_BASE}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify(body) }).then(handle),
  del: (path) => fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } }).then(handle),
  upload: (path, form) => fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: form }).then(handle),
  uploadPatch: (path, form) => fetch(`${API_BASE}${path}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${getToken()}` }, body: form }).then(handle),
  delete: (path) => fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } }).then(handle),
}

export const apiPublic = {
  post: (path, body) => fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(handle),
  upload: (path, form) => fetch(`${API_BASE}${path}`, { method: 'POST', body: form }).then(handle),
}

export function absUrl(u) {
  if (!u) return u
  if (/^https?:\/\//i.test(u)) return u
  // Trata caminhos relativos como /uploads/...
  return `${apiOrigin.replace(/\/$/, '')}${u}`
}
