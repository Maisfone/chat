import fs from 'fs'
import path from 'path'
import webpush from 'web-push'

const DEFAULT_VAPID_PUBLIC_KEY = 'BLX4iWgrhNgMUBR7yYLSu_LLHgE0ZbrFlrY9UBd3hGAfXc6SrOTcsVf2tdI1hJEzcXG3cg8NFIkNmvDXIK8sKm0'
const DEFAULT_VAPID_PRIVATE_KEY = 'wz5_vyjA5OiSNF5G_Ogz57fsvo-87HCJXkfb4z_cyR0'

const DATA_DIR = process.env.CONFIG_DIR || 'data'
const FILE = path.join(DATA_DIR, 'push-subscriptions.json')

function ensureDir() { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {} }
function readAll() {
  ensureDir()
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return {} }
}
function writeAll(map) { ensureDir(); try { fs.writeFileSync(FILE, JSON.stringify(map, null, 2)) } catch {} }

export function setVapidFromEnv() {
  const pub = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!process.env.VAPID_PUBLIC_KEY) process.env.VAPID_PUBLIC_KEY = pub
  if (!process.env.VAPID_PRIVATE_KEY) process.env.VAPID_PRIVATE_KEY = priv
  try { webpush.setVapidDetails(subject, pub, priv) } catch {}
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
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
      if (e?.statusCode === 410 || e?.statusCode === 404) removeSubscription(userId, s.endpoint)
    }
  }
}

export async function sendToUsers(userIds, payload) {
  await Promise.all(userIds.map(id => sendToUser(id, payload)))
}

