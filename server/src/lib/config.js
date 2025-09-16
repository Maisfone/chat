import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.CONFIG_DIR || 'data'
const FILE = path.join(DATA_DIR, 'config.json')

function ensureDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

export function readConfig() {
  ensureDir()
  try {
    const txt = fs.readFileSync(FILE, 'utf-8')
    return JSON.parse(txt)
  } catch {
    return {}
  }
}

export function writeConfig(cfg) {
  ensureDir()
  try { fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2)) } catch {}
  return cfg
}

export function updateConfig(patch) {
  const current = readConfig()
  return writeConfig({ ...current, ...patch })
}

export function publicConfig() {
  const cfg = readConfig()
  return { chatIconUrl: cfg.chatIconUrl || null }
}

