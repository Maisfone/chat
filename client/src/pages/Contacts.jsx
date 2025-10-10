import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, absUrl } from '../services/api.js'

export default function Contacts() {
  const nav = useNavigate()
  const [contacts, setContacts] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get('/users/all')
        setContacts(list)
      } catch (e) {
        setErr(e.message || 'Falha ao carregar contatos')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = contacts.filter(c => {
    const s = (c.name + ' ' + (c.email || '')).toLowerCase()
    return s.includes(q.toLowerCase())
  })

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 font-medium">
        Contatos
      </div>
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto bg-white/80 dark:bg-slate-800/70 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" className="flex-1 border rounded px-3 py-2" />
          </div>
          {loading ? (
            <div className="text-sm text-slate-600">Carregando...</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.map(c => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.avatarUrl ? (
                      <img src={absUrl(c.avatarUrl)} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-300" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate">{c.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.phone && (
                      <span className="text-xs text-slate-500 hidden md:inline">{c.phone}</span>
                    )}
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      onClick={() => {
                        const params = new URLSearchParams()
                        if (c.phone) params.set('to', c.phone)
                        params.set('name', c.name)
                        params.set('id', c.id)
                        nav(`/telefonia?${params.toString()}`)
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.25 6.75c0-1.24 1.01-2.25 2.25-2.25h3c.97 0 1.8.62 2.1 1.54l.86 2.58a2.25 2.25 0 0 1-.57 2.31l-1.21 1.21a12.06 12.06 0 0 0 4.88 4.88l1.21-1.21a2.25 2.25 0  1  2.31-.57l2.58.86c.92.3 1.54 1.13 1.54 2.1v3c0 1.24-1.01 2.25-2.25 2.25H18c-8.28 0-15-6.72-15-15v-3Z"/></svg>
                      Ligar
                    </button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-6 text-sm text-slate-500 text-center">Nenhum contato encontrado</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
