import fs from 'fs'
import path from 'path'
import webpush from 'web-push'

const DATA_DIR = process.env.CONFIG_DIR || 'data'
const FILE = path.join(DATA_DIR, 'push-subscriptions.json')
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json')

function ensureDir() { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {} }
// Inscrições ficam em memória; o arquivo é lido uma vez e gravado de forma assíncrona.
// (Antes o arquivo era lido do disco, de forma síncrona, para cada destinatário de cada mensagem.)
let cache = null
let writeTimer = null
function readAll() {
  if (cache) return cache
  ensureDir()
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { cache = {} }
  return cache
}
function writeAll() {
  clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    ensureDir()
    fs.promises.writeFile(FILE, JSON.stringify(cache || {}, null, 2)).catch(() => {})
  }, 500)
}

let vapidReady = false

// Chaves VAPID: variáveis de ambiente -> data/vapid.json -> geradas e salvas na primeira execução
function loadOrCreateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  }
  ensureDir()
  try {
    const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'))
    if (saved?.publicKey && saved?.privateKey) return saved
  } catch {}
  const keys = webpush.generateVAPIDKeys()
  try { fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 }) } catch {}
  console.log('Chaves VAPID geradas em', VAPID_FILE)
  return keys
}

export function setVapidFromEnv() {
  if (vapidReady) return
  const { publicKey, privateKey } = loadOrCreateVapidKeys()
  process.env.VAPID_PUBLIC_KEY = publicKey
  process.env.VAPID_PRIVATE_KEY = privateKey
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidReady = true
  } catch (e) {
    console.error('Falha ao configurar VAPID', e?.message)
  }
}

export function getVapidPublicKey() {
  setVapidFromEnv()
  return process.env.VAPID_PUBLIC_KEY
}

export function saveSubscription(userId, subscription) {
  const map = readAll()
  map[userId] = map[userId] || []
  const exists = (map[userId] || []).some(s => s?.endpoint === subscription?.endpoint)
  if (!exists) map[userId].push(subscription)
  writeAll()
  return true
}

export function removeSubscription(userId, endpoint) {
  const map = readAll()
  if (!map[userId]) return
  map[userId] = map[userId].filter(s => s?.endpoint !== endpoint)
  writeAll()
}

export async function sendToUser(userId, payload) {
  setVapidFromEnv()
  const map = readAll()
  const subs = [...(map[userId] || [])]
  if (!subs.length) return
  const body = JSON.stringify(payload)
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, body, { TTL: 3600 })
    } catch (e) {
      // remove invalid endpoints
      // 403 = assinatura feita com outra chave VAPID; o cliente se reinscreve ao abrir o app
      if (e?.statusCode === 410 || e?.statusCode === 404 || e?.statusCode === 403) removeSubscription(userId, s.endpoint)
    }
  }))
}

// Envia para muitos usuários com no máximo 25 envios simultâneos
export async function sendToUsers(userIds, payload) {
  const map = readAll()
  const targets = userIds.filter((id) => map[id]?.length)
  for (let i = 0; i < targets.length; i += 25) {
    await Promise.all(targets.slice(i, i + 25).map((id) => sendToUser(id, payload)))
  }
}

