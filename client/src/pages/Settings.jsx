import React, { useEffect, useState } from 'react'
import { getUser } from '../state/auth.js'

export default function Settings() {
  const user = getUser()
  const [icon, setIcon] = useState('')
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('chat_icon')
    if (saved) { setIcon(saved); setUrl(saved.startsWith('data:') ? '' : saved) }
  }, [])

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setErr('Selecione uma imagem'); return }
    setErr('')
    const reader = new FileReader()
    reader.onload = () => { setIcon(String(reader.result)); setUrl('') }
    reader.readAsDataURL(f)
  }

  function save(e) {
    e.preventDefault()
    setMsg(''); setErr('')
    try {
      const val = url?.trim() || icon
      if (!val) { setErr('Defina uma imagem ou URL'); return }
      localStorage.setItem('chat_icon', val)
      try { window.dispatchEvent(new Event('chat:iconUpdated')) } catch {}
      setMsg('Ícone do chat atualizado!')
    } catch (e) {
      setErr('Falha ao salvar ícone')
    }
  }

  if (!user?.isAdmin) {
    return <div className="p-4">Acesso restrito ao administrador.</div>
  }

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-xl font-semibold">Configurações</h2>
      <p className="text-sm text-slate-600">Defina o ícone do chat exibido na barra lateral.</p>
      {msg && <div className="text-green-600 text-sm mt-2">{msg}</div>}
      {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
      <form onSubmit={save} className="mt-4 bg-white p-4 rounded border border-slate-200 grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-700">Imagem</label>
          <input className="mt-1" type="file" accept="image/*" onChange={onFile} />
          {icon && (
            <div className="mt-2">
              <img src={icon} alt="ícone" className="w-12 h-12 rounded-full object-cover border" />
            </div>
          )}
        </div>
        <div>
          <label className="text-sm text-slate-700">URL (opcional)</label>
          <input className="mt-1 w-full border rounded px-3 py-2" value={url} onChange={e=>{ setUrl(e.target.value); if (e.target.value) setIcon('') }} placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Salvar</button>
        </div>
      </form>
    </div>
  )
}

