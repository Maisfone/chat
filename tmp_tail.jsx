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
              disabled={!number || status==='calling' || status==='in-call' || !(sip?.data && sip?.data?.hasPassword && sip?.data?.domain && sip?.data?.extension)}
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

