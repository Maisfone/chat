import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { ioClient } from '../services/socket.js'

export default function Admin() {
  const [tab, setTab] = useState('grupos')
  const [error, setError] = useState('')
  const [sipOk, setSipOk] = useState(() => {
    try { return (localStorage.getItem('sip_registered') === '1') } catch { return false }
  })
  // Grupos
  const [name, setName] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  // Grupos: organização/paginação
  const [groupQuery, setGroupQuery] = useState('')
  const [groupAsc, setGroupAsc] = useState(true)
  const [groupPageSize, setGroupPageSize] = useState(10)
  const [groupPage, setGroupPage] = useState(1)
  const [groupCounts, setGroupCounts] = useState({})
  const [groupMenuOpen, setGroupMenuOpen] = useState(null)
  // Usuários
  const [users, setUsers] = useState([])
  // Paginação de usuários (Telefonia)
  const pageSize = 10
  const [page, setPage] = useState(1)
  const [uName, setUName] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uPhone, setUPhone] = useState('')
  const [uAddress, setUAddress] = useState('')
  const [uIsAdmin, setUIsAdmin] = useState(false)
  // Usuários: edição
  const [editingUser, setEditingUser] = useState(null)
  const [euName, setEuName] = useState('')
  const [euEmail, setEuEmail] = useState('')
  const [euPhone, setEuPhone] = useState('')
  const [euAddress, setEuAddress] = useState('')
  const [euIsAdmin, setEuIsAdmin] = useState(false)
  const [euSaving, setEuSaving] = useState(false)
  const [euPassword, setEuPassword] = useState('')
  const [euGroups, setEuGroups] = useState({})
  const [euGroupsOrig, setEuGroupsOrig] = useState({})
  const [euGroupFilter, setEuGroupFilter] = useState('')
  const [notice, setNotice] = useState('')
  // Configurações
  const [chatIcon, setChatIcon] = useState('')
  const [chatIconUrl, setChatIconUrl] = useState('')
  const [cfgMsg, setCfgMsg] = useState('')
  const [cfgErr, setCfgErr] = useState('')
  // Telefonia (SIP)
  const [sipMap, setSipMap] = useState({})
  const [sipMsg, setSipMsg] = useState('')
  const [sipList, setSipList] = useState([])
  const sip = sipList

  useEffect(() => { (async () => {
    try {
      const gs = await api.get('/groups/all')
      setGroups(gs)
      const us = await api.get('/users')
      setUsers(us)
    } catch (e) { setError('Sem permissão ou erro ao carregar') }
  })() }, [])

  useEffect(() => {
    const onSip = (e) => { try { setSipOk(!!(e?.detail?.registered)) } catch {} }
    window.addEventListener('sip:reg', onSip)
    return () => window.removeEventListener('sip:reg', onSip)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  // Ajusta página quando a lista de usuários mudar
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((users?.length || 0) / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [users])

  const pageUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return users.slice(start, start + pageSize)
  }, [users, page])

  // Grupos: computed lists
  const groupsFiltered = useMemo(() => {
    const q = groupQuery.trim().toLowerCase()
    let list = groups
    if (q) list = list.filter(g => (g.name||'').toLowerCase().includes(q))
    list = [...list].sort((a,b)=>{
      const an = (a.name||'').toLowerCase(); const bn = (b.name||'').toLowerCase()
      return groupAsc ? an.localeCompare(bn) : bn.localeCompare(an)
    })
    return list
  }, [groups, groupQuery, groupAsc])
  const groupsTotalPages = useMemo(() => Math.max(1, Math.ceil(groupsFiltered.length / groupPageSize)), [groupsFiltered, groupPageSize])
  useEffect(() => { if (groupPage > groupsTotalPages) setGroupPage(groupsTotalPages) }, [groupsTotalPages])
  const groupsPaged = useMemo(() => {
    const start = (groupPage - 1) * groupPageSize
    return groupsFiltered.slice(start, start + groupPageSize)
  }, [groupsFiltered, groupPage, groupPageSize])

  // Carregar contagem de membros para grupos exibidos
  useEffect(() => {
    (async () => {
      try {
        for (const g of groupsPaged) {
          if (g?.id && (groupCounts[g.id] === undefined)) {
            try {
              const list = await api.get(`/groups/${g.id}/members`)
              setGroupCounts(prev => ({ ...prev, [g.id]: Array.isArray(list) ? list.length : 0 }))
            } catch {}
          }
        }
      } catch {}
    })()
  }, [groupsPaged])

  // Fechar menu ao mudar filtros/página
  useEffect(() => { setGroupMenuOpen(null) }, [groupQuery, groupAsc, groupPage, groupPageSize])

  // Fechar menu de grupo ao clicar fora ou pressionar ESC
  useEffect(() => {
    function onDocClick() { setGroupMenuOpen(null) }
    function onKey(e) { if (e.key === 'Escape') setGroupMenuOpen(null) }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('chat_icon')
    if (saved) { setChatIcon(saved); setChatIconUrl(saved.startsWith('data:') ? '' : saved) }
  }, [])

  // Carregar contas SIP (admin)
  useEffect(() => { (async () => {
    try {
      const list = await api.get('/phone')
      setSipList(list)
      const m = {}
      list.forEach(a => { m[a.user.id] = { domain: a.domain || '', extension: a.extension || '', password: '' } })
      setSipMap(m)
    } catch {}
  })() }, [])

  // Auto-refresh do status dos ramais (a cada 15s) quando aba Telefonia ativa
  useEffect(() => {
    let timer
    async function refresh() {
      try { const list = await api.get('/phone'); setSipList(list) } catch {}
    }
    if (tab === 'telefonia') {
      refresh()
      timer = setInterval(refresh, 15000)
    }
    return () => { if (timer) clearInterval(timer) }
  }, [tab])

  // Ouvir eventos de status via Socket.IO para atualização imediata
  useEffect(() => {
    const s = ioClient()
    const onSip = () => { api.get('/phone').then(setSipList).catch(()=>{}) }
    try { s.on('sip:reg', onSip) } catch {}
    return () => { try { s.off('sip:reg', onSip) } catch {} }
  }, [])

  function onIconFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setCfgErr('Selecione uma imagem'); return }
    setCfgErr('')
    const reader = new FileReader()
    reader.onload = () => { setChatIcon(String(reader.result)); setChatIconUrl('') }
    reader.readAsDataURL(f)
  }

  function saveChatIcon(e) {
    e.preventDefault()
    setCfgMsg(''); setCfgErr('')
    try {
      const val = chatIconUrl?.trim() || chatIcon
      if (!val) { setCfgErr('Defina uma imagem ou URL'); return }
      localStorage.setItem('chat_icon', val)
      try { window.dispatchEvent(new Event('chat:iconUpdated')) } catch {}
      setCfgMsg('Ícone do chat atualizado!')
    } catch { setCfgErr('Falha ao salvar ícone') }
  }

  async function createGroup(e) {
    e.preventDefault()
    try {
      const g = await api.post('/groups', { name })
      setGroups([g, ...groups]); setName('')
    } catch { setError('Erro ao criar grupo') }
  }

  async function addMember() {
    try {
      const user = users.find(u => u.email === memberEmail)
      if (!user) return setError('Usuário não encontrado')
      const g = selectedGroup?.id
      if (!g) return
      await api.post(`/groups/${g}/members`, { userId: user.id })
      setMemberEmail('')
      alert('Membro adicionado!')
    } catch { setError('Erro ao adicionar membro') }
  }

  async function loadMembers(groupId) {
    try {
      const list = await api.get(`/groups/${groupId}/members`)
      setGroupMembers(list)
    } catch (e) { setError('Erro ao carregar membros') }
  }

  async function removeMember(userId) {
    try {
      const g = selectedGroup?.id
      if (!g) return
      await api.del(`/groups/${g}/members/${userId}`)
      setGroupMembers(prev => prev.filter(m => m.userId !== userId))
    } catch { setError('Erro ao remover membro') }
  }

  async function createUser(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/users', { name: uName, email: uEmail, password: uPassword, phone: uPhone, address: uAddress, isAdmin: uIsAdmin })
      const us = await api.get('/users')
      setUsers(us)
      setUName(''); setUEmail(''); setUPassword(''); setUPhone(''); setUAddress(''); setUIsAdmin(false)
      alert('Usuário criado!')
    } catch (e) { setError(e.message || 'Erro ao criar usuário') }
  }

  async function deleteUser(id) {
    if (!confirm('Deseja realmente excluir este usuário?')) return
    try {
      await api.del(`/users/${id}`)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch { setError('Falha ao excluir usuário') }
  }

  function openEditUser(u) {
    setEditingUser(u)
    setEuName(u?.name || '')
    setEuEmail(u?.email || '')
    setEuPhone(u?.phone || '')
    setEuAddress(u?.address || '')
    setEuIsAdmin(!!u?.isAdmin)
    setEuPassword('')
    ;(async ()=>{
      const map = {}
      try {
        await Promise.all((groups||[]).map(async (g)=>{
          try {
            const members = await api.get(`/groups/${g.id}/members`)
            map[g.id] = Array.isArray(members) ? !!members.find(m => (m.userId||m.id) === u.id) : false
          } catch { map[g.id] = false }
        }))
      } catch {}
      setEuGroups(map)
      setEuGroupsOrig(map)
    })()
  }

  function hasUserChanges() {
    if (!editingUser) return false
    if ((euPassword||'').trim()) return true
    if ((euName||'') !== (editingUser.name||'')) return true
    if ((euEmail||'') !== (editingUser.email||'')) return true
    if ((euPhone||'') !== (editingUser.phone||'')) return true
    if ((euAddress||'') !== (editingUser.address||'')) return true
    if (!!euIsAdmin !== !!editingUser.isAdmin) return true
    const keys = new Set([...(Object.keys(euGroupsOrig||{})), ...(Object.keys(euGroups||{}))])
    for (const k of keys) {
      if (!!euGroups[k] !== !!euGroupsOrig[k]) return true
    }
    return false
  }

  function onCloseEdit() {
    if (hasUserChanges() && !confirm('Descartar alterações não salvas?')) return
    setEditingUser(null)
  }

  async function saveEditUser(e) {
    e?.preventDefault?.()
    if (!editingUser) return
    setEuSaving(true)
    setError('')
    try {
      const body = { name: euName, email: euEmail, phone: euPhone, address: euAddress, isAdmin: euIsAdmin }
      await api.patch(`/users/${editingUser.id}`, body)
      const us = await api.get('/users')
      setUsers(us)
      setEditingUser(null)
    } catch (err) {
      setError(err.message || 'Falha ao salvar usuário')
    } finally { setEuSaving(false) }
  }

  async function saveSip(userId) {
    setSipMsg('')
    const data = sipMap[userId] || { domain: '', extension: '', password: '' }
    try {
      const body = { domain: (data.domain||'').trim(), extension: (data.extension||'').trim() }
      if (data.password && data.password.trim()) body.password = data.password.trim()
      await api.patch(`/phone/${userId}`, body)
      setSipMsg('Configuração SIP salva')
      setSipMap(prev => ({ ...prev, [userId]: { ...prev[userId], password: '' } }))
    } catch (e) {
      setError(e.message || 'Falha ao salvar SIP')
    }
  }

  return (
    <div className="p-4 overflow-auto h-full">
      {notice && (
        <div className="fixed top-3 right-3 z-50 bg-green-600 text-white px-3 py-2 rounded shadow">
          {notice}
        </div>
      )}
      
      <h2 className="text-2xl font-semibold">Admin</h2>
      <div className="mt-3 border-b border-slate-200">
        <div className="flex gap-4">
          <button onClick={()=>setTab('usuarios')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='usuarios'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Usuários</button>
          <button onClick={()=>setTab('grupos')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='grupos'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Grupos</button>
          <button onClick={()=>setTab('telefonia')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='telefonia'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Telefonia</button>
          <button onClick={()=>setTab('config')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='config'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Configurações</button>
        </div>

        {/* Modal editar usuário */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded border border-slate-200 dark:border-slate-700 p-4 shadow" onClick={(e)=>e.stopPropagation()}>
              <h4 className="text-lg font-medium">Editar Usuário</h4>
              <form onSubmit={saveEditUser} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2" placeholder="Nome" value={euName} onChange={e=>setEuName(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="E-mail" value={euEmail} onChange={e=>setEuEmail(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Telefone" value={euPhone} onChange={e=>setEuPhone(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Endereço" value={euAddress} onChange={e=>setEuAddress(e.target.value)} />
                <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Nova senha (opcional)" type="password" value={euPassword} onChange={e=>setEuPassword(e.target.value)} />
                <div className="md:col-span-2">
                  <div className="text-sm font-medium mb-1">Grupos</div>
                  <input className="border rounded px-2 py-1 mb-2 w-full" placeholder="Filtrar grupos..." value={euGroupFilter} onChange={e=>setEuGroupFilter(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
                    {(groups||[]).filter(g => (euGroupFilter||'').trim() ? (g.name||'').toLowerCase().includes(euGroupFilter.trim().toLowerCase()) : true).map(g => (
                      <label key={g.id} className="text-sm inline-flex items-center gap-2">
                        <input type="checkbox" checked={!!euGroups[g.id]} onChange={e=> setEuGroups(prev=>({ ...prev, [g.id]: e.target.checked }))} /> {g.name}
                      </label>
                    ))}
                  </div>
                </div>
                {error && <div className="md:col-span-2 text-sm text-red-600">{error}</div>}
                <div className="md:col-span-2 mt-1 flex items-center justify-end gap-2">
                  <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50" onClick={onCloseEdit}>Cancelar</button>
                  <button type="submit" disabled={euSaving} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{euSaving?'Salvando...':'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Telefonia (SIP) */}
        <div className={`min-w-[640px] flex-1 ${tab!=='telefonia' ? 'hidden' : ''}`}>
          <h3 className="text-lg font-medium">Contas SIP</h3>
          <div className="text-sm text-slate-600 mb-2">Administra domínio, ramal e senha SIP por usuário. A senha é opcional (deixe em branco para não alterar).</div>
          {sipMsg && <div className="text-sm text-green-700 mb-2">{sipMsg}</div>}
          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
          <div className="overflow-auto border border-slate-200 rounded bg-white p-4">
            <table className="min-w-[600px] w-auto text-sm table-fixed align-middle">
              <colgroup>
                <col />
                <col className="w-64" />
                <col className="w-28" />
                <col className="w-40" />
                <col className="w-56" />
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Usuário</th>
                  <th className="text-left px-3 py-2">Domínio</th>
                  <th className="text-left px-3 py-2">Ramal</th>
                  <th className="text-left px-3 py-2">Senha</th>
                  <th className="text-left px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => {
                  const v = sipMap[u.id] || { domain: '', extension: '', password: '' }
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="px-2 py-1 text-left">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-2 py-1 text-left">
                        <input className="border rounded px-2 h-8 text-sm w-full block ml-0" value={v.domain} onChange={e=>setSipMap(prev=>({ ...prev, [u.id]: { ...v, domain: e.target.value } }))} placeholder="pbx.exemplo.com" />
                      </td>
                      <td className="px-2 py-1 text-left">
                        <input className="border rounded px-2 h-8 text-sm w-24 block ml-0" value={v.extension} onChange={e=>setSipMap(prev=>({ ...prev, [u.id]: { ...v, extension: e.target.value } }))} placeholder="1001" />
                      </td>
                      <td className="px-2 py-1 text-left">
                        <input className="border rounded px-2 h-8 text-sm w-40 block ml-0" value={v.password} onChange={e=>setSipMap(prev=>({ ...prev, [u.id]: { ...v, password: e.target.value } }))} placeholder="senha do ramal" type="password" />
                      </td>
                      <td className="px-2 py-1 text-left">
                        {(() => {
                          const acc = (Array.isArray(sip) ? sip.find(a => a.user?.id === u.id) : null)
                          const ok = acc?.regRegistered
                          const info = acc?.regStatus ? `${ok?'Registrado':'Offline'} • ${acc.regStatus}` : (ok?'Registrado':'Offline')
                          return (
                            <span className="inline-flex items-center align-middle mr-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${ok?'bg-green-500':'bg-red-500'}`} title={info}></span>
                            </span>
                          )
                        })()}
                        <button className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 mr-2" onClick={()=>saveSip(u.id)}>Conectar</button>
                        <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50" onClick={async()=>{ try{ await api.post(`/phone/${u.id}/disconnect`, {}); const list = await api.get('/phone'); setSipList(list) } catch(e){ alert(e.message||'Falha ao desconectar') } }}>Desconectar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Paginação */}
            <div className="flex items-center justify-between p-2 text-sm">
              {(() => {
                const total = users.length
                const start = total ? (page - 1) * pageSize + 1 : 0
                const end = Math.min(page * pageSize, total)
                const totalPages = Math.max(1, Math.ceil(total / pageSize))
                return (
                  <>
                    <div className="text-slate-600">Mostrando {start}–{end} de {total}</div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        className={`px-2 py-1 rounded border ${page<=1?'opacity-50 cursor-not-allowed':'hover:bg-slate-50'}`}
                        onClick={()=> setPage(p => Math.max(1, p-1))}
                        disabled={page<=1}
                      >Anterior</button>
                      <span>Página {page} de {totalPages}</span>
                      <button
                        className={`px-2 py-1 rounded border ${page>=totalPages?'opacity-50 cursor-not-allowed':'hover:bg-slate-50'}`}
                        onClick={()=> setPage(p => Math.min(totalPages, p+1))}
                        disabled={page>=totalPages}
                      >Proxima</button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
      {error && <div className="text-red-600 mt-2">{error}</div>}

      {/* Configurações */}
      {tab==='config' && (
        <section className="mt-4">
          <h3 className="text-lg font-medium">Configurações do Chat</h3>
          <div className="mt-2 bg-white p-4 rounded border border-slate-200">
            {cfgMsg && <div className="text-green-600 text-sm mb-2">{cfgMsg}</div>}
            {cfgErr && <div className="text-red-600 text-sm mb-2">{cfgErr}</div>}
            <form onSubmit={saveChatIcon} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-700">Ícone (imagem)</label>
                <input className="mt-1" type="file" accept="image/*" onChange={onIconFile} />
                {chatIcon && (
                  <div className="mt-2">
                    <img src={chatIcon} alt="ícone" className="w-12 h-12 rounded-full object-cover border" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-slate-700">URL (opcional)</label>
                <input className="mt-1 w-full border rounded px-3 py-2" value={chatIconUrl} onChange={e=>{ setChatIconUrl(e.target.value); if (e.target.value) setChatIcon('') }} placeholder="https://..." />
              </div>
              <div className="md:col-span-2">
                <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Grupos: criar */}
      {tab==='grupos' && (
        <section className="mt-4">
          <h3 className="text-lg font-medium">Novo Grupo</h3>
          <form onSubmit={createGroup} className="flex gap-2 mt-2">
            <input className="border rounded px-3 py-2" placeholder="Nome do grupo" value={name} onChange={e=>setName(e.target.value)} />
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
          </form>
        </section>
      )}

      <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Lista de grupos */}
        <div className={`${tab!=='grupos' ? 'hidden' : ''} bg-white p-4 rounded border border-slate-200`}>
          <h3 className="text-lg font-medium">Grupos <span className="text-slate-500">({groupsFiltered.length})</span></h3>
          <div className="mt-3 flex items-center gap-2">
            <input className="border rounded px-2 py-1 text-sm" placeholder="Buscar grupo..." value={groupQuery} onChange={e=>{ setGroupQuery(e.target.value); setGroupPage(1) }} />
            <button className="px-2 py-1 text-sm rounded border hover:bg-slate-50" onClick={()=>setGroupAsc(v=>!v)} title={groupAsc?'Ordenar Z-A':'Ordenar A-Z'}>
              {groupAsc ? 'A→Z' : 'Z→A'}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {groupsPaged.map(g => (
              <li key={g.id} className={`relative flex items-center justify-between gap-2 px-2 py-1 rounded border ${selectedGroup?.id===g.id ? 'bg-blue-50 border-blue-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                <button className="text-left font-medium inline-flex items-center gap-2" onClick={()=>{ setSelectedGroup(g); loadMembers(g.id) }}>
                  <span>{g.name}</span>
                  <span className="inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{groupCounts?.[g.id] ?? '...'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button style={{display:'none'}} className="px-2 py-0.5 text-xs rounded border hover:bg-slate-50" onClick={async ()=>{
                    const novo = prompt('Novo nome do grupo', g.name)
                    if (!novo || novo.trim()===g.name) return
                    try { const up = await api.patch(`/groups/${g.id}`, { name: novo.trim() }); setGroups(groups.map(x=>x.id===g.id? up : x)); if (selectedGroup?.id===g.id) setSelectedGroup(up) } catch { alert('Falha ao renomear') }
                  }}>Editar</button>
                  <div className="relative">
                    <button className="px-2 py-0.5 text-xs rounded border hover:bg-slate-50" onClick={(e)=>{ e.stopPropagation(); setGroupMenuOpen(groupMenuOpen===g.id? null : g.id) }}>⋮</button>
                    {groupMenuOpen===g.id && (
                      <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 rounded shadow text-sm z-10" onClick={(e)=> e.stopPropagation()}>
                        <button className="block w-full text-left px-2 py-1 hover:bg-slate-50" onClick={async ()=>{
                          const novo = prompt('Novo nome do grupo', g.name)
                          if (!novo || novo.trim()===g.name) return
                          try { const up = await api.patch(`/groups/${g.id}`, { name: novo.trim() }); setGroups(groups.map(x=>x.id===g.id? up : x)); if (selectedGroup?.id===g.id) setSelectedGroup(up) } catch { alert('Falha ao renomear') }
                          setGroupMenuOpen(null)
                        }}>Editar</button>
                        <button className="block w-full text-left px-2 py-1 text-red-600 hover:bg-red-50" onClick={async ()=>{
                          if (!confirm('Excluir este grupo e suas mensagens?')) return
                          try { await api.del(`/groups/${g.id}`); setGroups(groups.filter(x=>x.id!==g.id)); if (selectedGroup?.id===g.id) setSelectedGroup(null) } catch { alert('Falha ao excluir') }
                          setGroupMenuOpen(null)
                        }}>Excluir</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {/* Paginação de grupos */}
          <div className="mt-3 flex items-center justify-between text-sm">
            {(() => {
              const total = groupsFiltered.length
              const start = total ? (groupPage - 1) * groupPageSize + 1 : 0
              const end = Math.min(groupPage * groupPageSize, total)
              return (
                <>
                  <div className="text-slate-600">Mostrando {start}–{end} de {total}</div>
                  <div className="inline-flex items-center gap-2">
                    <select className="border rounded px-2 py-1 text-sm" value={groupPageSize} onChange={e=>{ setGroupPageSize(parseInt(e.target.value)||10); setGroupPage(1) }}>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                    <button className={`px-2 py-1 rounded border ${groupPage<=1?'opacity-50 cursor-not-allowed':'hover:bg-slate-50'}`} onClick={()=>setGroupPage(p=>Math.max(1,p-1))} disabled={groupPage<=1}>Anterior</button>
                    <span>Página {groupPage} de {groupsTotalPages}</span>
                    <button className={`px-2 py-1 rounded border ${groupPage>=groupsTotalPages?'opacity-50 cursor-not-allowed':'hover:bg-slate-50'}`} onClick={()=>setGroupPage(p=>Math.min(groupsTotalPages,p+1))} disabled={groupPage>=groupsTotalPages}>Proxima</button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Adicionar membro */}
        <div className={tab!=='grupos' ? 'hidden' : ''}>
          <h3 className="text-lg font-medium">Adicionar Membro</h3>
          <div className="text-sm text-slate-600">Grupo: {selectedGroup?.name || '-'}</div>
          <div className="mt-3 flex gap-2">
            <input className="border rounded px-3 py-2" placeholder="E-mail do Usuário" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} />
            <button className="inline-flex items-center justify-center rounded bg-slate-700 text-white px-3 py-2 hover:bg-slate-800" onClick={addMember} disabled={!selectedGroup}>Adicionar</button>
          </div>
        </div>

        {/* Usuários */}
        <div className={`min-w-[480px] flex-1 ${tab!=='usuarios' ? 'hidden' : ''}`}>
          <h3 className="text-lg font-medium">Usuários</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <form onSubmit={createUser} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2">
              <h4 className="font-medium">Novo Usuário</h4>
              <input className="border rounded px-3 py-2" placeholder="Nome" value={uName} onChange={e=>setUName(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="E-mail" value={uEmail} onChange={e=>setUEmail(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Senha" type="password" value={uPassword} onChange={e=>setUPassword(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Telefone" value={uPhone} onChange={e=>setUPhone(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Endereço" value={uAddress} onChange={e=>setUAddress(e.target.value)} />
              <label className="text-sm"><input type="checkbox" className="mr-2" checked={uIsAdmin} onChange={e=>setUIsAdmin(e.target.checked)} /> Admin</label>
              <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
            </form>
            <div className="bg-white p-4 rounded border border-slate-200">
              <h4 className="font-medium">Lista</h4>
              <ul className="mt-2 space-y-2">
                {users.map(u => (
                  <li key={u.id} className="flex items-center justify-between">
                    <div>
                      <button className="hover:underline" onClick={()=>alert('Edite este usuário na Proxima versão')}>{u.name}</button>{' - '} {u.email} {u.isAdmin ? ' • admin' : ''} {u.isBlocked ? ' • bloqueado' : ''}
                    </div>
                    <button onClick={()=>openEditUser(u)} className="text-blue-600 hover:underline mr-3">Editar</button>
                    <button onClick={()=>deleteUser(u.id)} className="text-red-600 hover:underline">Excluir</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


