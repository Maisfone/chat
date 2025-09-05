import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { useNavigate } from 'react-router-dom'

export default function Meetings() {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [title, setTitle] = useState('Reunião')
  const [description, setDescription] = useState('')
  const [isInstant, setIsInstant] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [emails, setEmails] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get('/meetings')
        setItems(list)
      } catch (e) {
        setErr(e.message || 'Falha ao carregar reuniões')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function createMeeting(e) {
    e?.preventDefault?.()
    setErr('')
    setCreating(true)
    try {
      const participants = emails.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }))
      const body = {
        title: title || 'Reunião',
        description: description || undefined,
        isInstant,
        scheduledStart: !isInstant && start ? new Date(start).toISOString() : undefined,
        scheduledEnd: !isInstant && end ? new Date(end).toISOString() : undefined,
        participants
      }
      const created = await api.post('/meetings', body)
      // refresh list
      const list = await api.get('/meetings')
      setItems(list)
      setTitle('Reunião')
      setDescription('')
      setIsInstant(true)
      setStart(''); setEnd(''); setEmails('')
      // entrar se instantânea
      if (created?.code && created?.isInstant) nav(`/telefonia?to=${created.code}&name=${encodeURIComponent(created.title)}`)
    } catch (e) {
      setErr(e.message || 'Falha ao criar reunião')
    } finally {
      setCreating(false)
    }
  }

  async function addParticipants(meetingId) {
    const input = prompt('Informe e-mails separados por vírgula:')
    if (!input) return
    try {
      const participants = input.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }))
      await api.post(`/meetings/${meetingId}/participants`, { participants })
      const list = await api.get('/meetings')
      setItems(list)
    } catch (e) {
      alert(e.message || 'Falha ao adicionar convidados')
    }
  }

  function enterMeeting(code, title) {
    nav(`/telefonia?to=${code}&name=${encodeURIComponent(title || 'Reunião')}`)
  }

  function copy(text) {
    try { navigator.clipboard.writeText(text); alert('Copiado!') } catch { alert(text) }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 dark:bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 font-medium">Reuniões</div>
      <div className="flex-1 p-4 space-y-6">
        <form onSubmit={createMeeting} className="max-w-3xl bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Nova reunião</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Título</span>
              <input value={title} onChange={e=>setTitle(e.target.value)} className="border rounded px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6 md:mt-0">
              <input type="checkbox" checked={isInstant} onChange={e=>setIsInstant(e.target.checked)} />
              Instantânea
            </label>
            {!isInstant && (
              <>
                <label className="flex flex-col text-sm">
                  <span className="text-slate-600 mb-1">Início</span>
                  <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="border rounded px-3 py-2" />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="text-slate-600 mb-1">Fim</span>
                  <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="border rounded px-3 py-2" />
                </label>
              </>
            )}
            <label className="md:col-span-2 flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Descrição (opcional)</span>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} className="border rounded px-3 py-2" rows={2} />
            </label>
            <label className="md:col-span-2 flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Convidados (e-mails, separados por vírgula)</span>
              <input value={emails} onChange={e=>setEmails(e.target.value)} className="border rounded px-3 py-2" placeholder="exemplo@dominio.com, outro@dominio.com" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="submit" disabled={creating} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{creating ? 'Criando...' : 'Criar'}</button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </form>

        <div className="max-w-4xl bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Minhas reuniões</h3>
          {loading ? (
            <div className="text-sm text-slate-600">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhuma reunião encontrada</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map(m => (
                <li key={m.id} className="py-3 flex items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.title} <span className="text-xs text-slate-500">#{m.code}</span></div>
                    <div className="text-xs text-slate-500 truncate">
                      {m.isInstant ? 'Instantânea' : 'Agendada'}{m.scheduledStart ? ` • ${new Date(m.scheduledStart).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50" onClick={()=>enterMeeting(m.code, m.title)}>Entrar</button>
                    <button className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50" onClick={()=>addParticipants(m.id)}>Convidar</button>
                    <button className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50" onClick={()=>nav(`/reunioes/${m.id}`)}>Detalhes</button>
                    <button className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50" onClick={()=>copy(m.code)}>Copiar código</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
