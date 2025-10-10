import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'

export default function MeetingDetails() {
  const { id } = useParams()
  const nav = useNavigate()
  const [m, setM] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/meetings/${id}`)
        setM(data)
      } catch (e) {
        setErr(e.message || 'Falha ao carregar')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function copy(text) { try { navigator.clipboard.writeText(text) } catch {} }

  async function addParticipants() {
    const input = prompt('Informe e-mails separados por vírgula:')
    if (!input) return
    try {
      const participants = input.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }))
      await api.post(`/meetings/${id}/participants`, { participants })
      const data = await api.get(`/meetings/${id}`)
      setM(data)
    } catch (e) {
      alert(e.message || 'Falha ao adicionar')
    }
  }

  if (loading) return <div className="p-4">Carregando...</div>
  if (err) return <div className="p-4 text-red-600">{err}</div>
  if (!m) return <div className="p-4">Não encontrado</div>

  const joinUrl = (code) => `${window.location.origin}/join/` // invite token will be per participant below

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 font-medium">Detalhes da reunião</div>
      <div className="flex-1 p-4 space-y-4">
        <div className="max-w-3xl bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="text-xl font-semibold">{m.title} <span className="text-xs text-slate-500">#{m.code}</span></div>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {m.isInstant ? 'Instantânea' : 'Agendada'}{m.scheduledStart ? ` • ${new Date(m.scheduledStart).toLocaleString()}` : ''}
          </div>
          {m.description && <div className="mt-2 text-sm">{m.description}</div>}
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600" onClick={()=>nav(`/telefonia?to=${m.code}&name=${encodeURIComponent(m.title)}`)}>Entrar</button>
            <button className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600" onClick={()=>copy(m.code)}>Copiar código</button>
            <button className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600" onClick={addParticipants}>Convidar</button>
          </div>
        </div>

        <div className="max-w-3xl bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="font-semibold mb-2">Participantes</div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {m.participants.map(p => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">{p.name || p.email}</div>
                  <div className="text-xs text-slate-500">{p.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.inviteToken && (
                    <button className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600" onClick={()=>copy(`${window.location.origin}/join/${p.inviteToken}`)}>Copiar link</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

