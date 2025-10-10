import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.CONFIG_DIR || 'data'
const FILE = path.join(DATA_DIR, 'config.json')

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch {}
}

function normalizeConfig(cfg = {}) {
  const next = { ...cfg }
  if (!Array.isArray(next.alertSounds)) next.alertSounds = []
  next.alertSounds = next.alertSounds.filter((item) => item && item.id && item.url)
  if (!next.alertSounds.some((item) => item.id === next.activeAlertSoundId)) {
    next.activeAlertSoundId = next.alertSounds[0]?.id || null
  }
  return next
}

export function readConfig() {
  ensureDir()
  try {
    const txt = fs.readFileSync(FILE, 'utf-8')
    return normalizeConfig(JSON.parse(txt))
  } catch {
    return normalizeConfig({})
  }
}

export function writeConfig(cfg) {
  ensureDir()
  const normalized = normalizeConfig(cfg)
  try {
    fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2))
  } catch {}
  return normalized
}

export function updateConfig(patch) {
  const current = readConfig()
  return writeConfig({ ...current, ...patch })
}

export function publicConfig() {
  const cfg = readConfig()
  const active = cfg.alertSounds.find((item) => item.id === cfg.activeAlertSoundId)
  return {
    chatIconUrl: cfg.chatIconUrl || null,
    chatWallpaperUrl: cfg.chatWallpaperUrl || null,
    alertSoundUrl: active?.url || null,
  }
}
