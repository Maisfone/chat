import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { setAuth } from '../state/auth.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { email, password })
      setAuth(res.token, res.user)
      nav('/')
    } catch (e) {
      setError(e.message || 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid place-items-center h-screen bg-slate-50 dark:bg-slate-900">
      <form onSubmit={onSubmit} className="w-80 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Entrar</h2>
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>}
        <button disabled={loading} className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
          Não tem conta? <Link className="text-blue-500 dark:text-blue-400 hover:underline" to="/register">Cadastrar</Link>
        </div>
      </form>
    </div>
  )
}

