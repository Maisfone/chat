import { api } from './api.js'
import { createSipManager } from './sip.js'

let sipMgr = null
let initialized = false
let initPromise = null
let retryTimer = null

function updateRegFlag(registered) {
  try {
    localStorage.setItem('sip_registered', registered ? '1' : '0')
    window.dispatchEvent(new CustomEvent('sip:reg', { detail: { registered } }))
  } catch {}
}

function scheduleRetry(delayMs = 3000) {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    try { init().catch(()=>{}) } catch {}
  }, delayMs)
}

function getIceServers() {
  const servers = []
  try {
    const stun = import.meta.env.VITE_STUN_URLS // CSV
    if (stun) stun.split(',').map(s => s.trim()).filter(Boolean).forEach(u => servers.push({ urls: u }))
    const turn = import.meta.env.VITE_TURN_URLS // CSV
    const user = import.meta.env.VITE_TURN_USERNAME
    const pass = import.meta.env.VITE_TURN_CREDENTIAL
    if (turn) turn.split(',').map(s => s.trim()).filter(Boolean).forEach(u => {
      servers.push(user && pass ? { urls: u, username: user, credential: pass } : { urls: u })
    })
  } catch {}
  // fallback comum
  if (!servers.length) servers.push({ urls: 'stun:stun.l.google.com:19302' })
  return servers
}

export async function init() {
  if (initialized) return sipMgr
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const wsUrl = import.meta.env.VITE_SIP_WS_URL
      if (!wsUrl) { initialized = true; return null }
      // Fetch my SIP account
      const me = await api.get('/phone/me').catch(() => null)
      if (!me || !me.hasPassword || !me.domain || !me.extension) { initialized = true; return null }

      sipMgr = await createSipManager({
        wsUrl,
        domain: me.domain,
        extension: me.extension,
        password: me.password || '',
        iceServers: getIceServers(),
      })

      if (sipMgr?.on) {
        try { sipMgr.on('registered', () => updateRegFlag(true)) } catch {}
        try { sipMgr.on('unregistered', () => updateRegFlag(false)) } catch {}
        try { sipMgr.on('registrationFailed', () => { updateRegFlag(false); scheduleRetry(5000) }) } catch {}
        try { sipMgr.on('disconnected', () => { updateRegFlag(false); scheduleRetry(3000) }) } catch {}
      }

      await sipMgr.start()
      updateRegFlag(!!sipMgr?.isRegistered?.())

      // Keep-alive on visibility/network changes
      try {
        document.addEventListener('visibilitychange', () => {
          if (!sipMgr?.isRegistered?.()) {
            sipMgr.start?.().catch(()=>{})
          }
        })
      } catch {}
      try { window.addEventListener('online', () => { sipMgr?.start?.().catch(()=>{}) }) } catch {}

      // Periodic re-register
      try {
        setInterval(() => { try { sipMgr?.ua?.register && sipMgr.ua.register() } catch {} }, 240000)
      } catch {}

      initialized = true
      return sipMgr
    } catch (e) {
      initialized = false
      scheduleRetry(5000)
      return null
    } finally {
      initPromise = null
    }
  })()
  return initPromise
}

export function getSipManager() {
  return sipMgr
}

export function isReady() { return !!sipMgr }
