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
  next.chatIconUrl = typeof next.chatIconUrl === 'string' && next.chatIconUrl.trim() ? next.chatIconUrl : null
  next.chatWallpaperUrl = typeof next.chatWallpaperUrl === 'string' && next.chatWallpaperUrl.trim() ? next.chatWallpaperUrl : null
  next.loginLogoUrl = typeof next.loginLogoUrl === 'string' && next.loginLogoUrl.trim() ? next.loginLogoUrl : null
  if (!Array.isArray(next.alertSounds)) next.alertSounds = []
  next.alertSounds = next.alertSounds.filter((item) => item && item.id && item.url)
  if (!next.alertSounds.some((item) => item.id === next.activeAlertSoundId)) {
    next.activeAlertSoundId = next.alertSounds[0]?.id || null
  }
  next.backup = normalizeBackup(next.backup)
  return next
}

function normalizeBackup(raw = {}) {
  const backup = typeof raw === 'object' && raw ? { ...raw } : {}
  backup.autoEnabled = Boolean(backup.autoEnabled)
  backup.time = validateTime(backup.time) || '02:00'
  const retention = Number(backup.retentionDays)
  backup.retentionDays = Number.isFinite(retention) && retention >= 0 ? Math.round(retention) : 7
  backup.lastAutoRunAt = backup.lastAutoRunAt || null
  backup.lastManualRunAt = backup.lastManualRunAt || null
  backup.lastManualResult = backup.lastManualResult || null
  backup.lastAutoResult = backup.lastAutoResult || null
  backup.lastRestoreAt = backup.lastRestoreAt || null
  backup.lastRestoreName = backup.lastRestoreName || null
  backup.lastRestoreActor = backup.lastRestoreActor || null
  return backup
}

function validateTime(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
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
    loginLogoUrl: cfg.loginLogoUrl || null,
    alertSoundUrl: active?.url || null,
  }
}
