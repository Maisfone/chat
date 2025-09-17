import express from 'express'
import { authRequired } from '../middleware/auth.js'
import { getVapidPublicKey, saveSubscription, removeSubscription, sendToUser } from '../lib/push.js'

const router = express.Router()
router.use(authRequired)

router.get('/vapid-public-key', (req, res) => {
  res.json({ key: getVapidPublicKey() })
})

router.post('/subscribe', (req, res) => {
  try {
    const sub = req.body?.subscription
    if (!sub?.endpoint) return res.status(400).json({ error: 'Subscription inválida' })
    saveSubscription(req.user.id, sub)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao salvar subscription' })
  }
})

router.post('/unsubscribe', (req, res) => {
  try {
    const endpoint = req.body?.endpoint
    if (!endpoint) return res.status(400).json({ error: 'Endpoint ausente' })
    removeSubscription(req.user.id, endpoint)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao remover subscription' })
  }
})

router.post('/test', async (req, res) => {
  try {
    await sendToUser(req.user.id, { title: 'Chat', body: 'Teste de notificação', tag: 'test' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Falha ao enviar teste' })
  }
})

export default router

