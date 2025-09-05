import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')

async function httpGet(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function MeetingInvite() {
  const { token } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    (async () => {
      try {
        const resp = await httpGet(`${API}/meetings/invite/${token}`)
        setData(resp)
      } catch (e) {
        setErr(e.message || 'Convite inválido')
      }
    })()
  }, [token])

  if (err) return <div className="p-6 max-w-xl mx-auto text-center"><div className="text-xl font-semibold mb-2">Convite inválido</div><div className="text-slate-600">{String(err)}</div></div>
  if (!data) return <div className="p-6 max-w-xl mx-auto text-center">Carregando...</div>

  const { meeting, participant } = data
  const joinLink = `/telefonia?to=${meeting.code}&name=${encodeURIComponent(meeting.title)}`

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-white/80 border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="text-xl font-semibold">Convite para reunião</div>
        <div className="mt-2 text-slate-700">{meeting.title}</div>
        {meeting.scheduledStart && (
          <div className="text-sm text-slate-500">{new Date(meeting.scheduledStart).toLocaleString()}</div>
        )}
        <div className="mt-4 text-sm text-slate-600">Convidado: {participant.name || participant.email || 'Convidado'}</div>
        <div className="mt-6 flex gap-3">
          <a href={joinLink} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Abrir no app</a>
          <button onClick={() => { navigator.clipboard.writeText(meeting.code).then(()=>alert('Código copiado')) }} className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50">Copiar código</button>
        </div>
        <div className="mt-4 text-xs text-slate-500">Se necessário, faça login para entrar.</div>
      </div>
    </div>
  )
}

