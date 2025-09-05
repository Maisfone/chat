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
        const ok = await sipMgrRef.current?.call(number, {
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
