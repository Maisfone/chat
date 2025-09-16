import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPublic } from '../services/api.js'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('As senhas nÃ£o conferem')
      return
    }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('name', name)
      form.append('email', email)
      form.append('password', password)
      if (avatar) form.append('avatar', avatar)
      await apiPublic.upload('/auth/register', form)
      // NÃ£o faz login automÃ¡tico para nÃ£o sobrescrever sessÃ£o de admin.
      // Redireciona para login com aviso simples via query string
      nav('/login?registered=1')
    } catch (e) {
      setError(e.message || 'Falha no cadastro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid place-items-center h-screen bg-slate-50 dark:bg-slate-900">
      <form onSubmit={onSubmit} className="w-[380px] bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm flex flex-col gap:2">
        <h2 className="text-xl font-semibold">Criar conta</h2>
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="Confirmar senha" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} />
        <div>
          <label className="text-sm text-slate-700 dark:text-slate-300">Imagem (avatar)</label>
          <input className="mt-1 block" type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; setAvatar(f||null); setPreview(f?URL.createObjectURL(f):'') }} />
          {preview && <div className="mt-2"><img src={preview} alt="preview" className="w-16 h-16 rounded-full object-cover" /></div>}
        </div>
        {error && <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>}
        <button disabled={loading} className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
        <div className="text-xs text-slate-600 mt-2">
          JÃ¡ possui conta? <Link className="text-blue-600 hover:underline" to="/login">Entrar</Link>
        </div>
      </form>
    </div>
  )
}

