import { API_BASE } from './api.js'
import { getToken } from '../state/auth.js'

function authHeader() {
  const token = getToken()
  if (!token) throw new Error('Token ausente para push')
  return `Bearer ${token}`
}

export async function getVapidKey() {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) throw new Error('Falha ao obter VAPID key')
  const data = await res.json()
  return data.key || ''
}

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push nao suportado')
  }
  const reg = await navigator.serviceWorker.ready
  const key = await getVapidKey()
  if (!key) throw new Error('VAPID publico ausente')
  const appServerKey = urlBase64ToUint8Array(key)

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    })
  }

  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({ subscription: sub }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Falha ao salvar inscricao push')
  }
  return true
}

export async function unsubscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {})
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

