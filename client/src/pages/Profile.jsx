import React, { useEffect, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { setAuth, getToken } from '../state/auth.js'

export default function Profile() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState('')
  const [initialPreview, setInitialPreview] = useState('')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const fileInputRef = useRef(null)
  const objectUrlRef = useRef('')

  // Helpers: mascara/validacao simples de telefone BR
  const digitsOnly = (s) => (s || '').replace(/\D/g, '')
  const formatBrPhone = (s) => {
    const d = digitsOnly(s).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
    if (d.length >= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    return d
  }

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try { URL.revokeObjectURL(objectUrlRef.current) } catch {}
      }
      objectUrlRef.current = ''
    }
  }

  useEffect(() => {
    return () => {
      releaseObjectUrl()
    }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('/users/me')
        setName(me.name || '')
        setPhone(me.phone ? formatBrPhone(me.phone) : '')
        setAddress(me.address || '')
        const nextPreview = me.avatarUrl || ''
        setInitialPreview(nextPreview)
        setPreview(nextPreview)
      } catch (e) {
        setErr('Falha ao carregar perfil')
      }
    })()
  }, [])

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null
    setAvatar(file)
    releaseObjectUrl()
    if (file) {
      try {
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        setPreview(url)
      } catch {
        setPreview(initialPreview)
      }
    } else {
      setPreview(initialPreview)
    }
  }

  async function saveProfile(e) {
    e.preventDefault()
    setMsg(''); setErr('')
    try {
      const phoneFmt = formatBrPhone(phone)
      const phoneDigits = digitsOnly(phoneFmt)
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) throw new Error('Telefone invalido (use DDD + numero).')

      const nameTrim = (name||'').trim()
      const addrTrim = (address||'').trim()
      const body = {
        phone: phoneDigits ? phoneFmt : null,
        address: addrTrim || null,
      }
      if (nameTrim) body.name = nameTrim

      if (avatar) {
        await api.patch('/users/me', body)
        const form = new FormData()
        form.append('avatar', avatar)
        await api.uploadPatch('/users/me', form)
      } else {
        await api.patch('/users/me', body)
      }

      try {
        const me = await api.get('/users/me')
        const nextPreview = me.avatarUrl || ''
        setName(me.name || '')
        setPhone(me.phone ? formatBrPhone(me.phone) : '')
        setAddress(me.address || '')
        releaseObjectUrl()
        setInitialPreview(nextPreview)
        setPreview(nextPreview)
        setAvatar(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        const tok = getToken()
        if (tok) setAuth(tok, me)
        try { window.dispatchEvent(new Event('chat:userUpdated')) } catch {}
      } catch {}

      setMsg('Perfil atualizado!')
    } catch (e) { setErr(e.message || 'Erro ao salvar') }
  }

  async function changePassword(e) {
    e.preventDefault()
    setMsg(''); setErr('')
    try {
      await api.post('/users/me/password', { current, password })
      setCurrent(''); setPassword('')
      setMsg('Senha alterada!')
    } catch (e) { setErr(e.message || 'Erro ao alterar senha') }
  }

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-xl font-semibold">Meu perfil</h2>
      {msg && <div className="text-green-600 text-sm mt-2">{msg}</div>}
      {err && <div className="text-red-600 text-sm mt-2">{err}</div>}

      <div className="mt-4 grid gap-4 md:grid-cols-[260px,1fr]">
        <section className="bg-white p-4 rounded border border-slate-200 flex flex-col items-center gap-3 text-center">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 flex items-center justify-center text-slate-500">
            {preview ? (
              <img
                src={preview}
                alt="avatar"
                className="w-full h-full object-cover"
                onError={() => setPreview('')}
              />
            ) : (
              <span className="text-sm">Sem foto</span>
            )}
          </div>
          <button
            type="button"
            onClick={triggerFileSelect}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-50"
          >
            Alterar foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          {avatar && (
            <div className="w-full text-xs text-slate-500 truncate">{avatar.name}</div>
          )}
          <p className="text-xs text-slate-500">
            Utilize imagens quadradas para melhor resultado.
          </p>
        </section>

        <form onSubmit={saveProfile} className="bg-white p-4 rounded border border-slate-200 grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-700">Nome</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-700">Telefone</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={phone} onChange={e=>setPhone(formatBrPhone(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-700">Endereco</label>
            <input className="mt-1 w-full border rounded px-3 py-2" value={address} onChange={e=>setAddress(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Salvar</button>
          </div>
        </form>
      </div>

      <form onSubmit={changePassword} className="mt-4 bg-white p-4 rounded border border-slate-200 grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-700">Senha atual</label>
          <input className="mt-1 w-full border rounded px-3 py-2" type="password" value={current} onChange={e=>setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-700">Nova senha</label>
          <input className="mt-1 w-full border rounded px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <button className="inline-flex items-center justify-center rounded bg-slate-700 text-white px-3 py-2 hover:bg-slate-800">Alterar senha</button>
        </div>
      </form>
    </div>
  )
}
