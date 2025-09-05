// Lightweight SIP manager wrapper around JsSIP, loaded lazily (dynamic import)
// Usage:
//   const sip = await createSipManager({ wsUrl, uri, password, iceServers })
//   await sip.start()
//   await sip.call('100')

async function loadJsSip() {
  // Avoid bundler resolution errors: prefer global via CDN
  if (typeof window !== 'undefined' && window.JsSIP) return window.JsSIP
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/jssip@3/dist/jssip.min.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar JsSIP via CDN'))
    document.head.appendChild(s)
  })
  try { window.JsSIP.debug.enable('JsSIP:*') } catch {}
  return window.JsSIP
}

export async function createSipManager({ wsUrl, domain, extension, password, iceServers }) {
  const JsSIP = await loadJsSip()

  const socket = new JsSIP.WebSocketInterface(wsUrl)
  const configuration = {
    sockets: [socket],
    uri: `sip:${extension}@${domain}`,
    authorization_user: extension,
    password,
    register: true,
    register_expires: 300,
    session_timers: false,
  }

  const ua = new JsSIP.UA(configuration)
  let session = null
  let registered = false

  function on(event, cb) { ua.on(event, cb) }

  function start() {
    return new Promise((resolve) => {
      const onReg = () => { registered = true; cleanup(); resolve() }
      const onFail = () => { cleanup(); resolve() }
      function cleanup() { try { ua.off('registered', onReg) } catch {}; try { ua.off('registrationFailed', onFail) } catch {} }
      ua.on('registered', onReg)
      ua.on('registrationFailed', onFail)
      try { ua.start() } catch { resolve() }
    })
  }

  function isRegistered() { return registered }

  function call(target, { onProgress, onAccepted, onEnded, onFailed, onTrack, audioDeviceId } = {}) {
    return new Promise((resolve, reject) => {
      const eventHandlers = {
        progress: (e) => { onProgress && onProgress(e) },
        failed: (e) => { session = null; onFailed && onFailed(e); resolve(false) },
        ended: (e) => { session = null; onEnded && onEnded(e); resolve(false) },
        confirmed: (e) => { onAccepted && onAccepted(e); resolve(true) },
      }
      const options = {
        eventHandlers,
        mediaConstraints: { audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true, video: false },
        pcConfig: { iceServers: iceServers || [], iceTransportPolicy: 'all' }
      }
      try {
        session = ua.call(/^sip:/i.test(target) ? target : `sip:${target}@${domain}`, options)
        // attach remote track
        try {
          session.connection.addEventListener('track', (ev) => {
            const [stream] = ev.streams
            onTrack && onTrack(stream)
          })
          session.connection.addEventListener('iceconnectionstatechange', () => {
            // helpful to debug connectivity; no-op
          })
        } catch {}
      } catch (e) {
        reject(e)
      }
    })
  }

  async function setAudioDevice(deviceId) {
    try {
      if (!session || !session.connection) return false
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
      const newTrack = stream.getAudioTracks()[0]
      if (!newTrack) return false
      const sender = session.connection.getSenders().find(s => s.track && s.track.kind === 'audio')
      if (sender) await sender.replaceTrack(newTrack)
      return true
    } catch { return false }
  }

  function dtmf(tone) {
    try { session?.sendDTMF?.(String(tone || '').substring(0,1)) } catch {}
  }

  function hangup() {
    try { session?.terminate() } catch {}
    session = null
  }

  return { ua, start, isRegistered, call, hangup, on, dtmf, setAudioDevice }
}
