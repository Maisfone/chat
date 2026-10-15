import fs from 'fs'
import path from 'path'
import webpush from 'web-push'

const DATA_DIR = process.env.CONFIG_DIR || 'data'
const FILE = path.join(DATA_DIR, 'push-subscriptions.json')
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json')

function ensureDir() { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {} }
function readAll() {
  ensureDir()
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return {} }
}
function writeAll(map) { ensureDir(); try { fs.writeFileSync(FILE, JSON.stringify(map, null, 2)) } catch {} }

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
  writeAll(map)
  return true
}

export function removeSubscription(userId, endpoint) {
  const map = readAll()
  if (!map[userId]) return
  map[userId] = map[userId].filter(s => s?.endpoint !== endpoint)
  writeAll(map)
}

export async function sendToUser(userId, payload) {
  setVapidFromEnv()
  const map = readAll()
  const subs = map[userId] || []
  for (const s of subs) {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload))
    } catch (e) {
      // remove invalid endpoints
      // 403 = assinatura feita com outra chave VAPID; o cliente se reinscreve ao abrir o app
      if (e?.statusCode === 410 || e?.statusCode === 404 || e?.statusCode === 403) removeSubscription(userId, s.endpoint)
    }
  }
}

export async function sendToUsers(userIds, payload) {
  await Promise.all(userIds.map(id => sendToUser(id, payload)))
}

