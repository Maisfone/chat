import express from 'express'
import { authRequired, adminRequired } from '../middleware/auth.js'
import { handleUploadSingle } from '../lib/storage.js'
import { publicConfig, readConfig, updateConfig } from '../lib/config.js'

const router = express.Router()

// Public config (no auth)
router.get('/public', (req, res) => {
  res.json(publicConfig())
})

router.use(authRequired)

// Helpers
function pickString(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return null
}

function currentAlertSound(cfg) {
  if (!cfg || !Array.isArray(cfg.alertSounds)) return null
  return cfg.alertSounds.find((item) => item?.id === cfg.activeAlertSoundId) || null
}

function broadcastAlertSound(req, cfg) {
  try {
    const active = currentAlertSound(cfg)
    req.io?.emit?.('config:alert-sound', {
      id: active?.id || null,
      url: active?.url || null,
    })
  } catch {}
}

// Admin: full config
router.get('/', adminRequired, (req, res) => {
  res.json(readConfig())
})

// Admin: patch simple fields
router.patch('/', adminRequired, (req, res) => {
  const current = readConfig()
  const patch = {}
  if ('chatIconUrl' in req.body) patch.chatIconUrl = req.body.chatIconUrl || null
  if ('chatWallpaperUrl' in req.body) patch.chatWallpaperUrl = req.body.chatWallpaperUrl || null
  if ('activeAlertSoundId' in req.body) {
    const id = pickString(req.body.activeAlertSoundId)
    if (id && !current.alertSounds?.some((item) => item?.id === id)) {
      return res.status(400).json({ error: 'Som de alerta não encontrado' })
    }
    patch.activeAlertSoundId = id || null
  }
  const cfg = updateConfig(patch)
  broadcastAlertSound(req, cfg)
  res.json(cfg)
})

// Admin: upload icon and persist URL
const uploadIcon = handleUploadSingle('icon')
router.post('/icon', adminRequired, uploadIcon, (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const cfg = updateConfig({ chatIconUrl: req.file.url })
    res.json({ ok: true, chatIconUrl: cfg.chatIconUrl })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao salvar ícone' })
  }
})

// Admin: upload wallpaper and persist URL
const uploadWallpaper = handleUploadSingle('wallpaper')
router.post('/wallpaper', adminRequired, uploadWallpaper, (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const cfg = updateConfig({ chatWallpaperUrl: req.file.url })
    res.json({ ok: true, chatWallpaperUrl: cfg.chatWallpaperUrl })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao salvar papel de parede' })
  }
})

// Admin: delete global wallpaper
router.delete('/wallpaper', adminRequired, (req, res) => {
  try {
    const cfg = updateConfig({ chatWallpaperUrl: null })
    res.status(200).json({ ok: true, chatWallpaperUrl: cfg.chatWallpaperUrl || null })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao excluir papel de parede' })
  }
})

function createAlertSoundId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const uploadSound = handleUploadSingle('sound')
router.post('/alert-sounds', adminRequired, uploadSound, (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const cfg = readConfig()
    const list = Array.isArray(cfg.alertSounds) ? [...cfg.alertSounds] : []
    const name = pickString(req.body?.name) || req.file.originalname || 'Som'
    const entry = {
      id: createAlertSoundId(),
      name,
      url: req.file.url,
      createdAt: new Date().toISOString(),
    }
    list.push(entry)
    const patch = { alertSounds: list }
    if (!cfg.activeAlertSoundId) patch.activeAlertSoundId = entry.id
    const updated = updateConfig(patch)
    broadcastAlertSound(req, updated)
    res.json({
      ok: true,
      alertSounds: updated.alertSounds,
      activeAlertSoundId: updated.activeAlertSoundId,
    })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao enviar som' })
  }
})

router.delete('/alert-sounds/:id', adminRequired, (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'ID ausente' })
    const cfg = readConfig()
    const list = Array.isArray(cfg.alertSounds) ? [...cfg.alertSounds] : []
    const exists = list.find((item) => item?.id === id)
    if (!exists) return res.status(404).json({ error: 'Som de alerta não encontrado' })
    const filtered = list.filter((item) => item?.id !== id)
    const patch = { alertSounds: filtered }
    if (cfg.activeAlertSoundId === id) {
      patch.activeAlertSoundId = filtered[0]?.id || null
    }
    const updated = updateConfig(patch)
    broadcastAlertSound(req, updated)
    res.json({
      ok: true,
      alertSounds: updated.alertSounds,
      activeAlertSoundId: updated.activeAlertSoundId,
    })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao excluir som' })
  }
})

router.post('/alert-sounds/:id/activate', adminRequired, (req, res) => {
  try {
    const { id } = req.params
    const cfg = readConfig()
    if (!id || id === 'none') {
      const updated = updateConfig({ activeAlertSoundId: null })
      broadcastAlertSound(req, updated)
      return res.json({
        ok: true,
        alertSounds: updated.alertSounds,
        activeAlertSoundId: updated.activeAlertSoundId,
      })
    }
    if (!cfg.alertSounds?.some((item) => item?.id === id)) {
      return res.status(404).json({ error: 'Som de alerta não encontrado' })
    }
    const updated = updateConfig({ activeAlertSoundId: id })
    broadcastAlertSound(req, updated)
    res.json({
      ok: true,
      alertSounds: updated.alertSounds,
      activeAlertSoundId: updated.activeAlertSoundId,
    })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao atualizar som ativo' })
  }
})

export default router
