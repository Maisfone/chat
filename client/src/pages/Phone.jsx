import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../services/api.js'
import { getSipManager } from '../services/sipBackground.js'

export default function Phone() {
  const loc = useLocation()
  const query = useMemo(() => new URLSearchParams(loc.search), [loc.search])
  const [number, setNumber] = useState(query.get('to') || '')
  const [name] = useState(query.get('name') || '')

  const [status, setStatus] = useState('idle') // idle | calling | in-call | ended | error
  const [error, setError] = useState('')
  const [sip, setSip] = useState({ loading: true, data: null, error: '' })
  const [sipReg, setSipReg] = useState({ registered: false })
  const [callInfo, setCallInfo] = useState({ phase: 'idle', reason: '' })
  const [callSeconds, setCallSeconds] = useState(0)
  const callTimerRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const sipMgrRef = useRef(null)

  // Load my SIP account (for display only)
  useEffect(() => { (async () => {
    try { const me = await api.get('/phone/me'); setSip({ loading: false, data: me, error: '' }) }
    catch (e) { setSip({ loading: false, data: null, error: e.message || 'Falha ao carregar SIP' }) }
  })() }, [])

  // Observe SIP registration from background manager
  useEffect(() => {
    const onReg = (e) => setSipReg({ registered: !!(e?.detail?.registered) })
    window.addEventListener('sip:reg', onReg)
    try { setSipReg({ registered: localStorage.getItem('sip_registered') === '1' }) } catch {}
    return () => window.removeEventListener('sip:reg', onReg)
  }, [])

  function startCallTimer() {
    stopCallTimer(); setCallSeconds(0)
    callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000)
  }
  function stopCallTimer() {
    try { clearInterval(callTimerRef.current) } catch {}
    callTimerRef.current = null
  }

  async function startCall() {
    setError('')
    const digits = String(number || '').replace(/\D/g, '')
    if (digits.length < 2) { setError('Informe um número/ramal válido'); return }
    try {
      const mgr = sipMgrRef.current || getSipManager()
      if (!mgr) { setError('SIP não inicializado/registrado'); setStatus('error'); return }
      sipMgrRef.current = mgr
      setStatus('calling')
      setCallInfo({ phase: 'progress', reason: '' })
      const ok = await mgr.call(digits, {
        onProgress: () => setCallInfo({ phase: 'progress', reason: '' }),
        onAccepted: () => { setStatus('in-call'); setCallInfo({ phase: 'accepted', reason: '' }); startCallTimer() },
        onEnded: () => { setStatus('ended'); setCallInfo({ phase: 'ended', reason: '' }); stopCallTimer() },
        onFailed: (e) => {
          const code = e?.response && (e.response.status_code || e.response?.statusCode)
          const cause = e?.cause || e?.message || ''
          setStatus('error'); setCallInfo({ phase: 'failed', reason: code ? `${code} ${cause}`.trim() : (cause || 'Falha SIP') }); stopCallTimer()
          setError(code ? `Falha SIP: ${code} ${cause||''}`.trim() : 'Falha SIP ou destino ocupado')
        },
        onTrack: (stream) => { try { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream } catch {} },
      })
      if (!ok) setStatus('ended')
    } catch (e) { setError(e.message || 'Falha ao iniciar chamada'); setStatus('error') }
  }

  function hangup() {
    try { sipMgrRef.current?.hangup?.() } catch {}
    setStatus('ended'); stopCallTimer()
  }

  const canCall = (() => {
    const digits = String(number || '').replace(/\D/g, '')
    return digits.length >= 2 && !!sipReg.registered && !!(sip?.data?.hasPassword && sip?.data?.domain && sip?.data?.extension)
  })()

  function handleDigit(t) {
    if (status === 'in-call' || status === 'calling') {
      try { sipMgrRef.current?.dtmf?.(t) } catch {}
    } else {
      setNumber(n => (n || '') + String(t))
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 font-medium">Telefonia</div>
      <div className="flex-1 p-4">
        <div className="max-w-xl mx-auto bg-white/80 dark:bg-slate-800/70 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Discador</h2>
          {name && <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">Contato: <span className="font-medium">{name}</span></div>}
          <div className="mb-3">
            {sip.loading ? (
              <div className="text-xs text-slate-500">Carregando configuração SIP...</div>
            ) : sip.error ? (
              <div className="p-2 rounded border border-red-300 bg-red-50 text-sm text-red-700">{sip.error}</div>
            ) : !sip.data || !sip.data.hasPassword ? (
              <div className="p-2 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-800">Sua conta SIP ainda não está configurada. Solicite ao administrador para cadastrar domínio, ramal e senha.</div>
            ) : (
              <div className="p-2 rounded border border-green-300 bg-green-50 text-sm text-green-800">Conta SIP configurada: <span className="font-medium">{sip.data.domain}</span> — Ramal <span className="font-medium">{sip.data.extension}</span></div>
            )}
          </div>
          <div className="mb-2 text-xs text-slate-600">SIP registro: {sipReg.registered ? 'registrado' : 'não registrado'}</div>

          <div className="flex items-center gap-2">
            <input value={number} onChange={(e)=>setNumber(e.target.value)} placeholder="Número/Ramal" className="flex-1 border rounded px-3 py-2" />
            <button disabled={!canCall || status==='calling' || status==='in-call'} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={startCall}>Ligar</button>
            <button disabled={!(status==='calling' || status==='in-call')} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" onClick={hangup}>Desligar</button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-xs">
            {[ '1','2','3','4','5','6','7','8','9','*','0','#' ].map(t => (
              <button key={t} className="px-4 py-3 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>handleDigit(t)}>{t}</button>
            ))}
            <button className="px-4 py-3 rounded border border-slate-300 hover:bg-slate-50 col-span-2" onClick={()=>setNumber('')}>Limpar</button>
            <button className="px-4 py-3 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>setNumber(n => String(n||'').slice(0,-1))}>⌫</button>
          </div>
          <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">Status: {status} {status==='in-call' && `(${Math.floor(callSeconds/60).toString().padStart(2,'0')}:${(callSeconds%60).toString().padStart(2,'0')})`}</div>
          <div className="mt-4">
            <div className="text-xs mb-1 text-slate-500">Áudio remoto</div>
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </div>
        </div>
      </div>
    </div>
  )
}
