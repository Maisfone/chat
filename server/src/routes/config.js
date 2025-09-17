import express from 'express'
import { adminRequired } from '../middleware/auth.js'
import { handleUploadSingle } from '../lib/storage.js'
import { publicConfig, readConfig, updateConfig } from '../lib/config.js'

const router = express.Router()

// Público: retorna configurações públicas
router.get('/public', (req, res) => {
  res.json(publicConfig())
})

// Admin: obter config completa
router.get('/', adminRequired, (req, res) => {
  res.json(readConfig())
})

// Admin: atualizar campos simples
router.patch('/', adminRequired, (req, res) => {
  const allowed = ['chatIconUrl', 'chatWallpaperUrl']
  const patch = {}
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k]
  const cfg = updateConfig(patch)
  res.json(cfg)
})

// Admin: upload do ícone e já persiste URL
const upload = handleUploadSingle('icon')
router.post('/icon', adminRequired, upload, (req, res) => {
  try {
    if (!req.file?.url) return res.status(400).json({ error: 'Arquivo ausente' })
    const cfg = updateConfig({ chatIconUrl: req.file.url })
    res.json({ ok: true, chatIconUrl: cfg.chatIconUrl })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao salvar ícone' })
  }
})

// Admin: upload do papel de parede (conversas) e já persiste URL
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

// Admin: excluir papel de parede global
router.delete('/wallpaper', adminRequired, (req, res) => {
  try {
    const cfg = updateConfig({ chatWallpaperUrl: null })
    res.status(200).json({ ok: true, chatWallpaperUrl: cfg.chatWallpaperUrl || null })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao excluir papel de parede' })
  }
})

export default router
