import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ioClient } from '../services/socket.js'
import { getUser } from '../state/auth.js'
import { api } from '../services/api.js'
import { createSipManager } from '../services/sip.js'

export default function Phone() {
  const loc = useLocation()
  const query = useMemo(() => new URLSearchParams(loc.search), [loc.search])
  const initialNumber = query.get('to') || ''
  const initialName = query.get('name') || ''
  const [number, setNumber] = useState(initialNumber)
  const [name] = useState(initialName)
  const [status, setStatus] = useState('idle') // idle | calling | ringing | in-call | ended | error
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [mics, setMics] = useState([])
  const [micId, setMicId] = useState('')
  const localAudioRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const roomRef = useRef(initialNumber)
  const incomingOfferRef = useRef(null)
  const [incoming, setIncoming] = useState({ has: false, fromName: '' })
  const ringIntervalRef = useRef(null)
  const audioCtxRef = useRef(null)
  const callTimerRef = useRef(null)
  const [callSeconds, setCallSeconds] = useState(0)
  const user = getUser()
  const [debug, setDebug] = useState(false)
  const [pcState, setPcState] = useState({ conn: 'new', ice: 'new' })
  const [sip, setSip] = useState({ loading: true, data: null, error: '' })
  const sipMgrRef = useRef(null)
  const isSipCallRef = useRef(false)
  const [sipReg, setSipReg] = useState({ registering: false, registered: false, error: '' })
  const [callInfo, setCallInfo] = useState({ phase: 'idle', reason: '' })

  // Propagar estado de registro SIP para o app (indicador no menu)
  useEffect(() => {
    try {
      localStorage.setItem('sip_registered', sipReg.registered ? '1' : '0')
      window.dispatchEvent(new CustomEvent('sip:reg', { detail: { registered: sipReg.registered } }))
    } catch {}
    // Envia heartbeat para admin ver status de cada ramal
    try {
      api.post('/phone/me/status', { registered: !!sipReg.registered, status: sipReg.error || '' }).catch(()=>{})
    } catch {}
    // Notifica via socket para dashboards abertos
    try {
      const s = ioClient()
      s.emit('sip:reg', { userId: user?.id, registered: !!sipReg.registered, status: sipReg.error || '', at: Date.now() })
    } catch {}
  }, [sipReg.registered])

  useEffect(() => { roomRef.current = number }, [number])

  // Carregar status da conta SIP do usuário (admin define; usuário apenas visualiza)
  useEffect(() => { (async () => {
    try {
      const me = await api.get('/phone/me')
      setSip({ loading: false, data: me, error: '' })
      // Se tem conta SIP, tenta registrar
      if (me?.hasPassword && me?.domain && me?.extension) {
        try {
          const wsUrl = import.meta.env.VITE_SIP_WS_URL
          if (wsUrl) {
            setSipReg({ registering: true, registered: false, error: '' })
            const mgr = await createSipManager({ wsUrl, domain: me.domain, extension: me.extension, password: me.password || '', iceServers: getIceServers() })
            sipMgrRef.current = mgr
            // Eventos de registro
            try {
              mgr.on('registered', () => setSipReg({ registering: false, registered: true, error: '' }))
              mgr.on('registrationFailed', (e) => setSipReg({ registering: false, registered: false, error: (e?.cause || 'Falha no registro') }))
              mgr.on('unregistered', () => setSipReg((prev)=>({ ...prev, registered: false })))
            } catch {}
            await mgr.start()
            setSipReg((prev)=>({ registering: false, registered: (prev.registered || mgr.isRegistered?.() || false), error: prev.error }))
          }
        } catch (e) {
          console.warn('SIP register failed (check VITE_SIP_WS_URL):', e)
          setSipReg({ registering: false, registered: false, error: (e?.message || 'Falha no registro SIP') })
        }
      }
    } catch (e) {
      setSip({ loading: false, data: null, error: e.message || 'Falha ao carregar SIP' })
    }
  })() }, [])

  // Carregar dispositivos de áudio/vídeo disponíveis
  useEffect(() => {
    async function loadDevices() {
      try {
        try { await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {}
        const list = await navigator.mediaDevices.enumerateDevices()
        const micList = list.filter(d => d.kind === 'audioinput')
        setMics(micList)
        if (!micId && micList[0]) setMicId(micList[0].deviceId)
      } catch {}
    }
    loadDevices()
    const onChange = () => loadDevices()
    try { navigator.mediaDevices.addEventListener('devicechange', onChange) } catch {}
    return () => { try { navigator.mediaDevices.removeEventListener('devicechange', onChange) } catch {} }
  }, [])

  useEffect(() => {
    return () => {
      try { hangup(false) } catch {}
      stopRinging()
      stopCallTimer()
    }
  }, [])

  useEffect(() => {
    const s = ioClient()
    if (!number) return
    try { s.emit('webrtc:join', number) } catch {}
    const onSignal = async (data) => {
      try {
        if (data.type === 'offer') {
          // Guardar oferta e tocar toque até aceitar/recusar
          incomingOfferRef.current = data.sdp
          setIncoming({ has: true, fromName: data.fromName || 'Chamando...' })
          setStatus('ringing')
          startRinging()
        } else if (data.type === 'answer') {
          if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp))
          setStatus('in-call')
          stopRinging()
          startCallTimer()
        } else if (data.type === 'candidate') {
          if (pcRef.current && data.candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } else if (data.type === 'hangup') {
          hangup(false)
        }
      } catch (e) {
        setError(e.message || 'Falha no signaling')
        setStatus('error')
      }
    }
    s.on('webrtc:signal', onSignal)
    return () => { try { s.off('webrtc:signal', onSignal); s.emit('webrtc:leave', number) } catch {} }
  }, [number])

  function getIceServers() {
    // Defaults + optional env-provided servers
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }]
    try {
      const stun = import.meta.env.VITE_STUN_URLS // comma separated
      if (stun) stun.split(',').map(s => s.trim()).filter(Boolean).forEach(u => servers.push({ urls: u }))
      const turn = import.meta.env.VITE_TURN_URLS // comma separated turn: URIs
      const user = import.meta.env.VITE_TURN_USERNAME
      const pass = import.meta.env.VITE_TURN_CREDENTIAL
      if (turn) turn.split(',').map(s => s.trim()).filter(Boolean).forEach(u => servers.push(user && pass ? { urls: u, username: user, credential: pass } : { urls: u }))
    } catch {}
    return servers
  }

  async function ensurePeer() {
    if (pcRef.current) return pcRef.current
    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    pc.onicecandidate = (ev) => {
      if (ev.candidate) ioClient().emit('webrtc:signal', { room: roomRef.current, data: { type: 'candidate', candidate: ev.candidate } })
    }
    pc.ontrack = (ev) => {
      const [stream] = ev.streams
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream
    }
    pc.onnegotiationneeded = async () => {
      try {
        if (makingOfferRef.current) return
        makingOfferRef.current = true
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ioClient().emit('webrtc:signal', { room: roomRef.current, data: { type: 'offer', sdp: offer } })
      } catch {} finally {
        makingOfferRef.current = false
      }
    }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      setPcState(prev => ({ ...prev, conn: st }))
      if (st === 'disconnected' || st === 'failed' || st === 'closed') setStatus('ended')
    }
    pc.oniceconnectionstatechange = () => {
      try { setPcState(prev => ({ ...prev, ice: pc.iceConnectionState })) } catch {}
    }
    pcRef.current = pc
    return pc
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current
    const constraints = { audio: micId ? { deviceId: { exact: micId } } : true }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    localStreamRef.current = stream
    if (localAudioRef.current) localAudioRef.current.srcObject = stream
    return stream
  }

  async function enableCamera() {
    const pc = await ensurePeer()
    const vConstraints = camId ? { deviceId: { exact: camId } } : true
    if (!vTrack) return
    // Attach to local combined stream for preview
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream()
      if (localAudioRef.current) localAudioRef.current.srcObject = localStreamRef.current
    }
    try { localStreamRef.current.addTrack(vTrack) } catch {}
    // Add to peer connection
  }

  function disableCamera() {
    if (sender && pcRef.current) {
      try { pcRef.current.removeTrack(sender) } catch {}
    }
    tracks.forEach(t => { try { t.stop() } catch {}; if (localStreamRef.current) { try { localStreamRef.current.removeTrack(t) } catch {} } })
  }

  function isExternalNumber(v) {
    return /^\+?\d{2,}$/.test((v||'').trim())
  }

  async function startCall() {
    setError('')
    if (!number) { setError('Informe um número/sala'); return }
    try {
      const s = ioClient()
      // Escolhe rota: externa (SIP) se número; senão P2P sala
      if (sip?.data && sip?.data?.hasPassword && isExternalNumber(number) && import.meta.env.VITE_SIP_WS_URL) {
        // SIP call
        isSipCallRef.current = true
        setStatus('calling')
        setCallInfo({ phase: 'progress', reason: '' })
        startRinging()
        // inicia chamada via SIP
        const _dial = (String(number||'').trim().replace(/\D/g,'').length <= 6) ? String(number).replace(/\D/g,'') : (function(v){ let raw=String(v||'').trim(); let d=raw.replace(/(?!^)\D/g,''); if (/^\+?55/.test(raw) || /^55/.test(d)) d=d.replace(/^\+?55/,''); d=d.replace(/^0+/, ''); const prefix=import.meta.env.VITE_SIP_PREFIX||''; return `${prefix}${d}` })(number)
        const ok = await sipMgrRef.current?.call(_dial, {
          onProgress: () => { setCallInfo({ phase: 'progress', reason: '' }) },
          onAccepted: () => { stopRinging(); setStatus('in-call'); setCallInfo({ phase: 'accepted', reason: '' }); startCallTimer() },
          onEnded: () => { setStatus('ended'); setCallInfo({ phase: 'ended', reason: '' }); stopRinging(); stopCallTimer() },
          onFailed: (e) => {
            const code = (e?.response && (e.response.status_code || e.response?.statusCode))
            const cause = e?.cause || e?.message || ''
            setStatus('error')
            setCallInfo({ phase: 'failed', reason: code ? `${code} ${cause||''}`.trim() : (cause || 'Falha SIP') })
            setError(code ? `Falha SIP: ${code} ${cause||''}`.trim() : 'Falha SIP ou destino ocupado')
            stopRinging()
          },
          onTrack: (remoteStream) => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream }
        })
        if (!ok) { /* handled by callbacks */ }
        return
      }
      // P2P (sala)
      // Check presence so we don't send offers to an empty room
      await new Promise((resolve) => {
        try { s.emit('webrtc:room:count', number, () => resolve()) } catch { resolve() }
      })
      s.emit('webrtc:room:count', number, async (info) => {
        const peers = (info?.count || 0) - 1 // excluding self after join
        if (peers <= 0) {
          // Warn but continue — callee must have a Telefonia aberta nessa sala
          setError('A outra pessoa ainda não está na sala. Abra a Telefonia do outro lado na mesma sala e clique em Atender.')
        }
        // proceed placing the call
      })
      await ensurePeer()
      const stream = await ensureLocalStream()
      stream.getTracks().forEach(t => pcRef.current.addTrack(t, stream))
      const offer = await pcRef.current.createOffer()
      await pcRef.current.setLocalDescription(offer)
      setStatus('calling')
      // Ringback tone and auto-timeout after 30s if no answer
      startRinging()
      try { clearTimeout(ringTimeoutRef.current) } catch {}
      ringTimeoutRef.current = setTimeout(() => {
        if (status === 'calling') {
          setError('Chamada sem resposta. Encerrando...')
          hangup(true)
        }
      }, 30000)
      s.emit('webrtc:join', number)
      s.emit('webrtc:signal', { room: number, data: { type: 'offer', sdp: offer, fromName: user?.name || 'Usuário', fromId: user?.id || '' } })
    } catch (e) {
      setStatus('error')
      setError(e.message || 'Falha ao iniciar chamada')
    }
  }

  function hangup(emit = true) {
    if (isSipCallRef.current && sipMgrRef.current) {
      try { sipMgrRef.current.hangup() } catch {}
      isSipCallRef.current = false
      setCallInfo({ phase: 'ended', reason: '' })
    }
    try {
      const s = ioClient()
      if (emit && number) s.emit('webrtc:signal', { room: number, data: { type: 'hangup' } })
    } catch {}
    try { pcRef.current?.getSenders()?.forEach(s => { try { pcRef.current.removeTrack(s) } catch {} }) } catch {}
    try { pcRef.current?.close() } catch {}
    pcRef.current = null
    try { localStreamRef.current?.getTracks()?.forEach(t => t.stop()) } catch {}
    localStreamRef.current = null
    if (localAudioRef.current) localAudioRef.current.srcObject = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setStatus('ended')
    stopRinging()
    stopCallTimer()
  }

  function toggleMute() {
    const tracks = localStreamRef.current?.getAudioTracks?.() || []
    const next = !muted
    tracks.forEach(t => t.enabled = !next)
    setMuted(next)
  }

  async function switchMicrophone(id) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true })
      const newTrack = newStream.getAudioTracks()[0]
      if (!newTrack) return
      const pc = await ensurePeer()
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio')
      if (sender) await sender.replaceTrack(newTrack)
      const oldTracks = localStreamRef.current?.getAudioTracks?.() || []
      oldTracks.forEach(t => { try { t.stop() } catch {}; try { localStreamRef.current.removeTrack(t) } catch {} })
      if (!localStreamRef.current) localStreamRef.current = new MediaStream()
      try { localStreamRef.current.addTrack(newTrack) } catch {}
      if (localAudioRef.current) localAudioRef.current.srcObject = localStreamRef.current
      setMicId(id)
    } catch (e) {
      setError(e.message || 'Falha ao trocar microfone')
    }
  }

  async function acceptCall() {
    try {
      const s = ioClient()
      await ensurePeer()
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))
      await ensureLocalStream()
      localStreamRef.current.getTracks().forEach(t => pcRef.current.addTrack(t, localStreamRef.current))
      const answer = await pcRef.current.createAnswer()
      await pcRef.current.setLocalDescription(answer)
      s.emit('webrtc:signal', { room: number, data: { type: 'answer', sdp: answer } })
      setIncoming({ has: false, fromName: '' })
      setStatus('in-call')
      stopRinging()
      startCallTimer()
    } catch (e) {
      setError(e.message || 'Falha ao atender')
      setStatus('error')
      stopRinging()
    }
  }

  function declineCall() {
    try { ioClient().emit('webrtc:signal', { room: number, data: { type: 'hangup' } }) } catch {}
    setIncoming({ has: false, fromName: '' })
    stopRinging()
    setStatus('idle')
  }

function startRinging() {
  stopRinging()
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    ringIntervalRef.current = setInterval(() => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = 800
        g.gain.value = 0.0001
        o.connect(g).connect(ctx.destination)
        o.start()
        // ramp up and down for a short beep
        g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
        setTimeout(() => { try { o.stop(); o.disconnect(); g.disconnect() } catch {} }, 300)
      }, 900)
    } catch {}
    try {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = setTimeout(() => {
        // auto-declinar após 30s tocando
        try { if (incoming.has) declineCall() } catch {}
      }, 30000)
    } catch {}
}

function stopRinging() {
  try { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null } catch {}
  const ctx = audioCtxRef.current
  if (ctx) { try { ctx.close() } catch {} }
  audioCtxRef.current = null
  try { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null } catch {}
}

  function startCallTimer() {
    stopCallTimer()
    setCallSeconds(0)
    callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000)
  }
  function stopCallTimer() {
    try { clearInterval(callTimerRef.current); callTimerRef.current = null } catch {}
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 font-medium">
        Telefonia
      </div>
      <div className="flex-1 p-4">
        <div className="max-w-xl mx-auto bg-white/80 dark:bg-slate-800/70 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Discador</h2>
          {name && (
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">Contato: <span className="font-medium">{name}</span></div>
          )}
          
          {incoming.has && status==='ringing' && (
            <div className="mb-3 p-3 border border-yellow-300 bg-yellow-50 rounded">
              <div className="font-medium mb-2">Chamada recebida de {incoming.fromName}</div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700" onClick={acceptCall}>Atender</button>
                <button className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700" onClick={declineCall}>Recusar</button>
              </div>
            </div>
          )}
          {/* Status da conta SIP (apenas informativo; admin gerencia) */}
          <div className="mb-3">
            {sip.loading ? (
              <div className="text-xs text-slate-500">Carregando configuração SIP...</div>
            ) : sip.error ? (
              <div className="p-2 rounded border border-red-300 bg-red-50 text-sm text-red-700">{sip.error}</div>
            ) : !sip.data || !sip.data.hasPassword ? (
              <div className="p-2 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-800">Sua conta SIP ainda não está configurada. Solicite ao administrador para cadastrar domínio, ramal e senha.</div>
            ) : (
              <div className="p-2 rounded border border-green-300 bg-green-50 text-sm text-green-800">
                Conta SIP configurada: <span className="font-medium">{sip.data.domain}</span> • Ramal <span className="font-medium">{sip.data.extension}</span>
              </div>
            )}
          </div>
          {/* Status de registro e chamada SIP */}
          {sip.data && (
            <div className="mb-3 text-xs text-slate-600">
              <div>
                SIP registro: {sipReg.registering ? 'registrando...' : (sipReg.registered ? 'registrado' : (sipReg.error ? `falha (${sipReg.error})` : 'não registrado'))}
              </div>
              {isSipCallRef.current && (
                <div>
                  Chamada SIP: {callInfo.phase}
                  {callInfo.reason && <span> • {callInfo.reason}</span>}
                </div>
              )}
            </div>
          )}
          {status==='calling' && (
            <div className="mb-3 p-3 border border-blue-300 bg-blue-50 rounded">
              <div className="font-medium mb-2">Chamando...</div>
              <div className="text-xs text-slate-600">Peça para a outra pessoa abrir a Telefonia na mesma sala e clicar em Atender.</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="w-24 text-slate-600">Microfone</span>
              <select value={micId} onChange={e => switchMicrophone(e.target.value)} className="flex-1 border rounded px-2 py-1">
                {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input value={number} onChange={e=>setNumber(e.target.value)} placeholder="Sala/Número" className="flex-1 border rounded px-3 py-2" />
            <button
              disabled={!number || status==='calling' || status==='in-call' || !/^\+?\d{2,}$/.test((number||'').trim()) || !(sipReg.registered && sip?.data && sip?.data?.hasPassword && sip?.data?.domain && sip?.data?.extension)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={startCall}
              title={!(sip?.data && sip?.data?.hasPassword && sip?.data?.domain && sip?.data?.extension) ? 'Conta SIP não configurada: peça ao admin para cadastrar' : 'Ligar'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.25 6.75c0-1.24 1.01-2.25 2.25-2.25h3c.97 0 1.8.62 2.1 1.54l.86 2.58a2.25 2.25 0 0 1-.57 2.31l-1.21 1.21a12.06 12.06 0 0 0 4.88 4.88l1.21-1.21a2.25 2.25 0 0 1 2.31-.57l2.58.86c.92.3 1.54 1.13 1.54 2.1v3c0 1.24-1.01 2.25-2.25 2.25H18c-8.28 0-15-6.72-15-15v-3Z"/></svg>
              Ligar
            </button>
            <button disabled={!((status==='calling' || status==='in-call' || status==='ringing' || status==='error') || pcRef.current || ringIntervalRef.current)} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" onClick={()=>hangup(true)}>
              Desligar
            </button>
            <button disabled={!(status==='in-call')} className={`inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 ${muted?'bg-slate-200 dark:bg-slate-700':''}`} onClick={toggleMute}>
              {muted ? 'Desmutar' : 'Mutar'}
            </button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">Status: {status} {status==='in-call' && `( ${Math.floor(callSeconds/60).toString().padStart(2,'0')}:${(callSeconds%60).toString().padStart(2,'0')} )`}</div>
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)} /> Debug</label>
          {debug && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 rounded p-2">
              <div>Conn: {pcState.conn} | ICE: {pcState.ice}</div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <div className="text-xs mb-1 text-slate-500">Você</div>
              <audio ref={localAudioRef} autoPlay muted playsInline />
            </div>
            <div>
              <div className="text-xs mb-1 text-slate-500">Remoto</div>
              <audio ref={remoteAudioRef} autoPlay playsInline />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


