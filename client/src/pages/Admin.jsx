import React, { useEffect, useState, useMemo } from 'react'
import { api } from '../services/api.js'

export default function Admin() {
  const [tab, setTab] = useState('usuarios') // 'usuarios' | 'grupos'
  const [error, setError] = useState('')

  // Users
  const [users, setUsers] = useState([])
  const [uName, setUName] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uIsAdmin, setUIsAdmin] = useState(false)

  // Groups
  const [groups, setGroups] = useState([])
  const [gName, setGName] = useState('')

  // Load lists (independent)
  useEffect(() => { (async () => {
    try { const us = await api.get('/users'); setUsers(Array.isArray(us)?us:[]) } catch (e) { setError(prev=>prev? prev+' • Usuários: '+(e.message||'falha') : 'Usuários: '+(e.message||'falha')) }
  })() }, [])
  useEffect(() => { (async () => {
    try { const gs = await api.get('/groups/all?includeDMs=false'); setGroups(Array.isArray(gs)?gs:[]) } catch (e) { setError(prev=>prev? prev+' • Grupos: '+(e.message||'falha') : 'Grupos: '+(e.message||'falha')) }
  })() }, [])

  const pageUsers = useMemo(()=>users.slice(0, 50), [users])
  const pageGroups = useMemo(()=>groups.slice(0, 50), [groups])

  async function createUser(e){
    e?.preventDefault?.(); setError('')
    try {
      await api.post('/users', { name: uName.trim(), email: uEmail.trim(), password: uPassword, isAdmin: !!uIsAdmin })
      const us = await api.get('/users'); setUsers(Array.isArray(us)?us:[])
      setUName(''); setUEmail(''); setUPassword(''); setUIsAdmin(false)
    } catch (e) { setError(e.message || 'Falha ao criar usuário') }
  }

  async function createGroup(e){
    e?.preventDefault?.(); setError('')
    const name = (gName||'').trim()
    if (name.length < 2) { setError('Informe um nome de grupo com 2+ caracteres.'); return }
    try {
      await api.post('/groups', { name })
      const gs = await api.get('/groups/all?includeDMs=false'); setGroups(Array.isArray(gs)?gs:[])
      setGName('')
    } catch (e) { setError(e.message || 'Falha ao criar grupo') }
  }

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-2xl font-semibold">Admin</h2>
      <div className="mt-3 border-b border-slate-200">
        <div className="flex gap-4">
          <button onClick={()=>setTab('usuarios')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='usuarios'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Usuários</button>
          <button onClick={()=>setTab('grupos')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='grupos'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Grupos</button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</div>
      )}

      {tab==='usuarios' && (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <form onSubmit={createUser} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2">
            <h4 className="font-medium">Novo Usuário</h4>
            <input className="border rounded px-3 py-2" placeholder="Nome" value={uName} onChange={e=>setUName(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="E-mail" value={uEmail} onChange={e=>setUEmail(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Senha" type="password" value={uPassword} onChange={e=>setUPassword(e.target.value)} />
            <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={uIsAdmin} onChange={e=>setUIsAdmin(e.target.checked)} /> Admin</label>
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
          </form>
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="flex items-center justify-between"><h4 className="font-medium">Lista</h4><div className="text-xs text-slate-500">{users.length} usuário(s)</div></div>
            {pageUsers.length ? (
              <ul className="mt-2 space-y-2">
                {pageUsers.map(u=> (
                  <li key={u.id} className="flex items-center justify-between">
                    <div><span className="font-medium">{u.name}</span> <span className="text-slate-500">- {u.email}</span> {u.isAdmin&&'• admin'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Nenhum usuário encontrado.</div>
            )}
          </div>
        </section>
      )}

      {tab==='grupos' && (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <form onSubmit={createGroup} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2">
            <h4 className="font-medium">Novo Grupo</h4>
            <input className="border rounded px-3 py-2" placeholder="Nome do grupo" value={gName} onChange={e=>setGName(e.target.value)} />
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
          </form>
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="flex items-center justify-between"><h4 className="font-medium">Lista</h4><div className="text-xs text-slate-500">{groups.length} grupo(s)</div></div>
            {pageGroups.length ? (
              <ul className="mt-2 space-y-1">
                {pageGroups.map(g=> (
                  <li key={g.id} className="px-2 py-1 rounded border border-slate-200">{g.name}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Nenhum grupo encontrado.</div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

