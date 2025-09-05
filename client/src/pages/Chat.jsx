import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api, absUrl } from '../services/api.js'
import { ioClient } from '../services/socket.js'
import { getUser } from '../state/auth.js'

export default function Chat() {
  // Lists and active conversation
  const [groups, setGroups] = useState([])
  const [dms, setDms] = useState([])
  const [people, setPeople] = useState([])
  const [active, setActive] = useState(null)

  // Messages and composer
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  // Audio recording
  const [recording, setRecording] = useState(false)
  const [recError, setRecError] = useState('')
  const [recTime, setRecTime] = useState(0)

  // UI state/refs
  const [leftOpen, setLeftOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [convQuery, setConvQuery] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const emojis = [
    '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','😉',
    '🙃','😅','😴','🤔','🙄','😐','😢','😭','😡','👍',
    '👎','👏','🙏','💪','🔥','✨','🎉','❤️','💙','💚',
    '💛','💜','🤝','👌','✌️','👀','☕','🍕','🎧','📞'
  ]
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const listRef = useRef(null)
  const bottomRef = useRef(null)
  const mediaRecRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const recTimerRef = useRef(null)
  const user = getUser()

  // Load lists (groups, DMs, people)
  useEffect(() => { (async () => {
    try {
      const g = await api.get('/groups')
      setGroups(g)
      const dmList = await api.get('/dm')
      setDms(dmList)
      const ppl = await api.get('/users/all')
      setPeople(ppl)
      // restore last active
      const saved = localStorage.getItem('chat_active')
      if (saved) {
        const foundG = g.find(x => x.id === saved)
        if (foundG) { setActive(foundG); return }
        const foundDM = dmList.find(x => x.groupId === saved)
        if (foundDM) { setActive({ id: foundDM.groupId, name: foundDM.other?.name || 'Direto' }); return }
      }
      if (g[0]) setActive(g[0])
    } catch (e) { setErr('Falha ao carregar listas') }
  })() }, [])

  // Join group rooms (badges realtime)
  useEffect(() => {
    const s = ioClient()
    try { groups.forEach(g => s.emit('group:join', g.id)) } catch {}
  }, [groups])

  // Join DM rooms (badges realtime)
  useEffect(() => {
    const s = ioClient()
    try { dms.forEach(dm => s.emit('group:join', dm.groupId)) } catch {}
  }, [dms])

  // Open DM with a person, creating if needed
  async function startConversation(otherId, closeDrawer = false) {
    setErr('')
    try {
      const dm = await api.get(`/dm/with/${otherId}`)
      if (dm?.groupId) {
        setDms(prev => [{ id: dm.groupId, groupId: dm.groupId, other: dm.other, _unread: 0 }, ...prev.filter(x => x.groupId !== dm.groupId)])
        setActive({ id: dm.groupId, name: dm.other?.name || 'Direto' })
        if (closeDrawer) setLeftOpen(false)
        return
      }
    } catch {}
    try {
      const dm = await api.post(`/dm/${otherId}`)
      if (dm?.groupId) {
        setDms(prev => [{ id: dm.groupId, groupId: dm.groupId, other: dm.other, _unread: 0 }, ...prev.filter(x => x.groupId !== dm.groupId)])
        setActive({ id: dm.groupId, name: dm.other?.name || 'Direto' })
        if (closeDrawer) setLeftOpen(false)
        return
      }
    } catch (e) { setErr(e.message || 'Falha ao abrir conversa'); return }
    setErr('Nao foi possivel iniciar a conversa')
  }

  // Load active messages and wire socket listeners
  useEffect(() => {
    if (!active) return
    let unsub = () => {}
    ;(async () => {
      const list = await api.get(`/messages/${active.id}?take=50`)
      setMessages(list.reverse())
      try { await api.post(`/messages/${active.id}/read`, {}) } catch {}
      setGroups(prev => prev.map(g => g.id === active.id ? { ...g, _unread: 0 } : g))
      setDms(prev => prev.map(d => d.groupId === active.id ? { ...d, _unread: 0 } : d))

      const s = ioClient()
      try { s.off('message:new') } catch {}
      try { s.off('message:deleted') } catch {}
      s.emit('group:join', active.id)

      const onNew = (msg) => {
        const ts = new Date(msg?.createdAt || Date.now()).getTime()
        if (msg.groupId === active.id) {
          setMessages(prev => {
            if (msg.replyTo?.id) {
              return prev.map(m => m.id === msg.replyTo.id ? { ...m, _count: { replies: (m._count?.replies || 0) + 1 } } : m).concat(msg)
            }
            return [...prev, msg]
          })
          // bump activity on active convo
          setGroups(prev => prev.map(g => g.id === active.id ? { ...g, _lastAt: ts } : g))
          setDms(prev => prev.map(d => d.groupId === active.id ? { ...d, _lastAt: ts } : d))
        } else {
          // unread + activity on other convos
          setGroups(prev => prev.map(g => g.id === msg.groupId ? { ...g, _unread: (g._unread || 0) + 1, _lastAt: ts } : g))
          setDms(prev => prev.map(d => d.groupId === msg.groupId ? { ...d, _unread: (d._unread || 0) + 1, _lastAt: ts } : d))
        }
      }
      const onDeleted = (payload) => {
        if (payload.groupId === active.id) setMessages(prev => prev.map(m => m.id === payload.id ? { ...m, deletedAt: payload.deletedAt } : m))
      }
      s.on('message:new', onNew)
      s.on('message:deleted', onDeleted)
      unsub = () => { setMenuFor(null); s.off('message:new', onNew); s.off('message:deleted', onDeleted); s.emit('group:leave', active.id) }
    })()
    return () => unsub()
  }, [active?.id])

  // Persist active id
  useEffect(() => {
    if (active?.id) {
      try { localStorage.setItem('chat_active', active.id) } catch {}
    }
  }, [active?.id])

  // Auto scroll on new messages
  useEffect(() => {
    const t = setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
      if (bottomRef.current) {
        try { bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }) } catch {}
      }
    }, 0)
    return () => clearTimeout(t)
  }, [messages, active?.id])

  async function sendMessage(e) {
    if (e && e.preventDefault) e.preventDefault()
    setErr('')
    if (!active) return
    try {
      const hasText = Boolean(text.trim())
      const hasFile = Boolean(file)
      if (hasText) {
        const content = text.trim()
        const isUrl = /^(https?:\/\/\S+)/i.test(content)
        const lower = content.toLowerCase()
        const isGif = isUrl && /(\.gif($|\?))/i.test(lower)
        const isImg = isUrl && /(\.png|\.jpg|\.jpeg|\.webp|\.bmp|\.svg)($|\?)/i.test(lower)
        const type = isGif ? 'gif' : (isImg ? 'image' : 'text')
        await api.post(`/messages/${active.id}`, { type, content, replyToId: replyTo?.id || null })
        setText('')
        setReplyTo(null)
      }
      if (hasFile) {
        const form = new FormData()
        form.append('file', file)
        const kind = file.type?.startsWith('audio') ? 'audio' : 'image'
        const q = replyTo?.id ? `&replyToId=${replyTo.id}` : ''
        await api.upload(`/messages/${active.id}/upload?type=${kind}${q}`, form)
        setFile(null)
        setReplyTo(null)
      }
    } catch (e) { setErr(e.message || 'Falha ao enviar mensagem') }
  }

  function startReply(m) { setReplyTo(m) }
  async function deleteMessage(m) {
    if (!confirm('Excluir esta mensagem?')) return
    try {
      await api.delete(`/messages/${m.id}`)
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deletedAt: new Date().toISOString() } : x))
    } catch (e) { setErr(e.message || 'Falha ao excluir') }
  }

  function goToFirstReply(m) {
    const target = messages.find(x => x.replyTo?.id === m.id)
    if (target) {
      const el = document.getElementById(`msg-${target.id}`)
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
        setHighlightId(target.id)
        setTimeout(() => setHighlightId(null), 2000)
      }
    }
  }

  // Emoji insert helper
  function insertEmoji(emo) {
    const el = inputRef.current
    if (!el) { setText(t => t + emo); setShowEmoji(false); return }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const next = text.slice(0, start) + emo + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emo.length
      try { el.setSelectionRange(pos, pos) } catch {}
    })
    setShowEmoji(false)
  }

  // Audio recording controls
  async function startRecording() {
    setRecError('')
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mime = (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      mediaRecRef.current = mr
      const chunks = []
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
      mr.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mime })
          const f = new File([blob], `rec-${Date.now()}.webm`, { type: mime })
          const form = new FormData()
          form.append('file', f)
          if (active?.id) await api.upload(`/messages/${active.id}/upload?type=audio`, form)
        } catch (e) { setRecError(e.message || 'Falha ao salvar áudio') }
        finally { cleanupRecording() }
      }
      mr.start()
      setRecording(true)
      setRecTime(0)
      recTimerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
    } catch (e) {
      setRecError('Acesso ao microfone negado ou indisponível')
      cleanupRecording()
    }
  }
  function stopRecording() { try { mediaRecRef.current?.stop() } catch {} }
  function cleanupRecording() {
    setRecording(false)
    if (recTimerRef.current) { try { clearInterval(recTimerRef.current) } catch {}; recTimerRef.current = null }
    setRecTime(0)
    try { mediaStreamRef.current?.getTracks?.().forEach(t => t.stop()) } catch {}
    mediaStreamRef.current = null
    mediaRecRef.current = null
  }

  // Filtered/sorted lists (WhatsApp-like: last activity desc, then unread desc, then name)
  const filteredGroups = useMemo(() => {
    const q = convQuery.trim().toLowerCase()
    const list = q ? groups.filter(g => (g.name || '').toLowerCase().includes(q)) : groups
    return [...list].sort((a,b) => {
      const la = a._lastAt || 0, lb = b._lastAt || 0
      if (la !== lb) return lb - la
      const ua = a._unread || 0, ub = b._unread || 0
      if (ua !== ub) return ub - ua
      return (a.name||'').localeCompare(b.name||'')
    })
  }, [groups, convQuery])

  const filteredPeople = useMemo(() => {
    const q = convQuery.trim().toLowerCase()
    const list = q ? people.filter(p => (p.name || '').toLowerCase().includes(q)) : people
    return [...list].sort((a,b) => {
      const da = dms.find(d => d.other?.id === a.id)
      const db = dms.find(d => d.other?.id === b.id)
      const la = da?._lastAt || 0, lb = db?._lastAt || 0
      if (la !== lb) return lb - la
      const ua = da?._unread || 0, ub = db?._unread || 0
      if (ua !== ub) return ub - ua
      return (a.name||'').localeCompare(b.name||'')
    })
  }, [people, dms, convQuery])

  return (
    <div className="relative flex h-full">
      {leftOpen && (
        <>
          <div className="absolute inset-0 bg-black/20 z-10" onClick={()=>setLeftOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 border-r border-slate-200 bg-white flex flex-col overflow-auto z-20">
            <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
              <input value={convQuery} onChange={e=>setConvQuery(e.target.value)} placeholder="Buscar conversas..." className="flex-1 border rounded px-3 py-1.5 text-sm" />
              <button className="text-slate-500 hover:text-slate-700" onClick={()=>setLeftOpen(false)} aria-label="Fechar">×</button>
            </div>
            <div className="px-3 py-2 font-semibold">Grupos</div>
            {filteredGroups.map(g => (
              <button key={g.id} onClick={() => { setActive(g); setLeftOpen(false) }} className={`px-3 py-2 hover:bg-slate-50 ${active?.id===g.id ? 'bg-blue-50 text-blue-700' : ''} flex items-center justify-between`}>
                <span className="truncate text-left">{g.name}</span>
                {g._unread > 0 && (
                  <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">{g._unread}</span>
                )}
              </button>
            ))}
            <div className="px-3 py-2 font-semibold border-t border-slate-200 mt-2">Pessoas</div>
            <div className="px-3 py-2 flex flex-col gap-1">
              {filteredPeople.map(p => {
                const dmInfo = dms.find(d => d.other?.id === p.id)
                const unread = dmInfo?._unread || 0
                return (
                  <button key={p.id} onClick={() => startConversation(p.id, true)} className="hover:bg-slate-50 rounded px-2 py-1 flex items-center justify-between">
                    <span className="flex items-center gap-2 truncate">
                      <Avatar url={p.avatarUrl} name={p.name} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    {unread > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">{unread}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 border-r border-slate-200 flex-col overflow-auto">
        <div className="px-3 py-2 border-b border-slate-200">
          <input value={convQuery} onChange={e=>setConvQuery(e.target.value)} placeholder="Buscar conversas..." className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <div className="px-3 py-2 font-semibold">Grupos</div>
        {filteredGroups.map(g => (
          <button key={g.id} onClick={() => setActive(g)} className={`px-3 py-2 hover:bg-slate-50 ${active?.id===g.id ? 'bg-blue-50 text-blue-700' : ''} flex items-center justify-between`}>
            <span className="truncate text-left">{g.name}</span>
            {g._unread > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">{g._unread}</span>
            )}
          </button>
        ))}
        <div className="px-3 py-2 font-semibold border-t border-slate-200 mt-2">Pessoas</div>
        <div className="px-3 py-2 flex flex-col gap-1">
          {filteredPeople.map(p => {
            const dmInfo = dms.find(d => d.other?.id === p.id)
            const unread = dmInfo?._unread || 0
            return (
              <button key={p.id} onClick={() => startConversation(p.id)} className="hover:bg-slate-50 rounded px-2 py-1 flex items-center justify-between">
                <span className="flex items-center gap-2 truncate">
                  <Avatar url={p.avatarUrl} name={p.name} />
                  <span className="truncate">{p.name}</span>
                </span>
                {unread > 0 && (
                  <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">{unread}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur font-medium flex items-center gap-2">
          <button type="button" className="md:hidden px-2 py-1 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>setLeftOpen(v=>!v)} aria-label="Abrir menu">☰</button>
          <span>{active?.name || 'Selecione um grupo'}</span>
        </div>

        <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3">
          {messages.map((m, i) => {
            const mine = (m.author?.id || m.authorId) === user?.id
            const bubbleClass = mine
              ? 'max-w-[75%] bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-md shadow-md'
              : 'max-w-[75%] bg-white text-slate-800 px-4 py-2.5 rounded-2xl rounded-tl-md shadow-md border border-slate-200/60'
            const lineClass = mine ? 'flex justify-end mb-2 items-end' : 'flex justify-start mb-2 items-end'
            const prev = messages[i - 1]
            const showDate = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
            const dateLabel = (() => {
              const date = new Date(m.createdAt)
              const now = new Date()
              const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
              const diff = (start(date) - start(now)) / 86400000
              if (diff === 0) return 'Hoje'
              if (diff === -1) return 'Ontem'
              return date.toLocaleDateString('pt-BR')
            })()
            return (
              <div key={m.id} id={`msg-${m.id}`} className="w-full">
                {showDate && (
                  <div className="text-center text-xs text-slate-500 my-2">{dateLabel}</div>
                )}
                <div className={`${lineClass} group`}>
                  {!mine && <div className="mr-2"><Avatar url={m.author?.avatarUrl} name={m.author?.name} /></div>}
                  <div className={`${bubbleClass} ${highlightId===m.id ? 'ring-2 ring-yellow-400' : ''}`}>
                    {m.replyTo && (
                      <div className="mb-1 pl-2 border-l-4 border-blue-400 text-xs text-slate-600">
                        <div className="font-medium">{m.replyTo.author?.name || 'Mensagem'}</div>
                        <div className="truncate opacity-90">
                          {m.replyTo.type === 'text' ? m.replyTo.content : (m.replyTo.type === 'image' ? 'Imagem' : (m.replyTo.type === 'audio' ? 'Áudio' : 'Anexo'))}
                        </div>
                      </div>
                    )}
                    {m.deletedAt ? (
                      <div className="italic opacity-70">Mensagem apagada</div>
                    ) : m.type === 'text' ? (
                      <div>{m.content}</div>
                    ) : m.type === 'image' || m.type === 'gif' ? (
                      <img src={absUrl(m.content)} alt="imagem" className="max-w-full rounded" />
                    ) : m.type === 'audio' ? (
                      <audio src={absUrl(m.content)} controls className="w-60" />
                    ) : (
                      <a className="underline" href={absUrl(m.content)} target="_blank" rel="noreferrer">Abrir anexo</a>
                    )}
                    <div className="mt-1 text-[10px] opacity-80">{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="ml-1 relative">
                    <button type="button" className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-700" onClick={()=>setMenuFor(menuFor===m.id? null : m.id)} aria-label="Ações">⋯</button>
                    {menuFor === m.id && (
                      <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded shadow text-sm z-10">
                        <button className="block w-full text-left px-3 py-1.5 hover:bg-slate-50" onClick={()=>{ setMenuFor(null); startReply(m) }}>Responder</button>
                        {(m.author?.id || m.authorId) === user?.id && (
                          <button className="block w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50" onClick={()=>{ setMenuFor(null); deleteMessage(m) }}>Apagar</button>
                        )}
                        {m._count?.replies > 0 && <button className="block w-full text-left px-3 py-1.5 hover:bg-slate-50" onClick={()=>{ setMenuFor(null); goToFirstReply(m) }}>Ir para respostas</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {replyTo && (
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-start gap-2">
            <div className="border-l-4 border-blue-500 pl-2 text-sm text-slate-700 flex-1">
              <div className="font-medium">Respondendo {replyTo.author?.name || 'mensagem'}</div>
              <div className="truncate">{replyTo.type === 'text' ? replyTo.content : (replyTo.type === 'image' ? 'Imagem' : (replyTo.type === 'audio' ? 'Áudio' : 'Anexo'))}</div>
            </div>
            <button className="text-slate-500 hover:text-slate-700" onClick={()=>setReplyTo(null)}>Cancelar</button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 p-2 border-t border-slate-200 items-center relative">
          <button type="button" onClick={()=>setShowEmoji(v=>!v)} title="Emojis" className="px-2 py-1 rounded hover:bg-slate-100" aria-label="Emojis">😊</button>
          <button type="button" onClick={()=>fileInputRef.current?.click()} title="Anexar" className="inline-flex shrink-0 items-center justify-center p-2 rounded hover:bg-slate-100" aria-label="Anexar">📎</button>
          <input ref={fileInputRef} type="file" accept="image/*,audio/*" onChange={e=>setFile(e.target.files?.[0] || null)} className="hidden" />
          {file && (
            <div className="max-w-[45%] truncate text-xs text-slate-700 bg-slate-100 rounded px-2 py-1 flex items-center gap-2">
              <span className="truncate" title={file.name}>{file.name}</span>
              <button type="button" className="text-slate-500 hover:text-red-600" onClick={()=>setFile(null)}>✕</button>
            </div>
          )}
          <input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} placeholder="Mensagem (suporta URL .gif/.jpg etc.)" className="flex-1 border rounded px-3 py-2" />
          <button
            type="button"
            onClick={() => { if ((text || '').trim() || file) { sendMessage() } else { recording ? stopRecording() : startRecording() } }}
            className={`${((text || '').trim() || file) ? 'bg-blue-600 text-white hover:bg-blue-700' : (recording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300')} inline-flex items-center justify-center rounded-full w-10 h-10`}
            title={((text || '').trim() || file) ? 'Enviar' : (recording ? 'Parar gravação' : 'Gravar áudio')}
          >
            {((text || '').trim() || file) ? '➤' : (recording ? '■' : '🎤')}
          </button>
          {recording && <span className="text-xs text-red-600 min-w-[60px]">⏺ {recTime}s</span>}
          {err && <div className="text-red-600 text-sm ml-2">{err}</div>}
          {recError && <div className="text-red-600 text-sm ml-2">{recError}</div>}

          {showEmoji && (
            <div className="absolute bottom-12 left-2 bg-white border border-slate-200 rounded-md p-2 shadow max-w-[280px] z-10">
              <div className="grid grid-cols-8 gap-1">
                {emojis.map(e => (
                  <button key={e} type="button" onClick={()=>insertEmoji(e)} className="text-xl leading-6 hover:bg-slate-100 rounded px-1">{e}</button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function Avatar({ url, name }) {
  const size = 28
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover' }
  if (url) return <img src={absUrl(url)} alt={name||'avatar'} style={style} />
  const initials = (name||'U').trim().slice(0,2).toUpperCase()
  return <div style={{ ...style, background:'#cbd5e1', color:'#334155', display:'grid', placeItems:'center', fontSize:12, fontWeight:'bold' }}>{initials}</div>
}

