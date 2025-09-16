import React, { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { setAuth, getToken } from '../state/auth.js'

export default function Profile() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState('')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('') 
  const [err, setErr] = useState('') 
 
  // Helpers: máscara/validação simples de telefone BR
  const digitsOnly = (s) => (s || '').replace(/\D/g, '')
  const formatBrPhone = (s) => {
    const d = digitsOnly(s).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
    if (d.length >= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    return d
  }

  useEffect(() => { (async () => {
    try {
      const me = await api.get('/users/me')
      setName(me.name || '')
      setPhone(me.phone ? formatBrPhone(me.phone) : '') 
      setAddress(me.address || '')
      setPreview(me.avatarUrl || '')
    } catch (e) { setErr('Falha ao carregar perfil') }
  })() }, [])

  async function saveProfile(e) { 
    e.preventDefault() 
    setMsg(''); setErr('') 
    try { 
      const phoneFmt = formatBrPhone(phone)
      const phoneDigits = digitsOnly(phoneFmt)
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) throw new Error('Telefone inválido (use DDD + número).')

      const nameTrim = (name||'').trim()
      const addrTrim = (address||'').trim()
      const body = { 
        phone: phoneDigits ? phoneFmt : null, 
        address: addrTrim || null, 
      }
      if (nameTrim) body.name = nameTrim

      if (avatar) { 
        // Atualiza campos textuais primeiro (JSON), depois avatar (multipart)
        await api.patch('/users/me', body)
        const form = new FormData() 
        form.append('avatar', avatar) 
        await api.uploadPatch('/users/me', form) 
      } else { 
        await api.patch('/users/me', body) 
      } 
      // Atualiza preview buscando o perfil novamente
      try {
        const me = await api.get('/users/me')
        setPreview(me.avatarUrl || preview)
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

      <form onSubmit={saveProfile} className="mt-4 bg-white p-4 rounded border border-slate-200 grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-700">Nome</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-700">Telefone</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={phone} onChange={e=>setPhone(formatBrPhone(e.target.value))} />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm text-slate-700">Endereço</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={address} onChange={e=>setAddress(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-700">Avatar</label>
          <input className="mt-1" type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; setAvatar(f||null); setPreview(f?URL.createObjectURL(f):preview) }} />
          {preview && <img src={preview} alt="avatar" className="mt-2 w-20 h-20 rounded-full object-cover" />}
        </div>
        <div className="md:col-span-2">
          <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Salvar</button>
        </div>
      </form>

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
