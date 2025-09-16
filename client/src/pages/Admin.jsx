import React, { useEffect, useState, useMemo, useRef } from 'react' 
import { getUser } from '../state/auth.js'
import { api } from '../services/api.js'

export default function Admin() { 
  const me = getUser()
  const [tab, setTab] = useState('usuarios') // 'usuarios' | 'grupos' | 'telefonia' | 'configuracoes'
  const [error, setError] = useState('')

  // Users
  const [users, setUsers] = useState([])
  const [uName, setUName] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uPhone, setUPhone] = useState('')
  const [uAddress, setUAddress] = useState('')
  const [uIsAdmin, setUIsAdmin] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // user object
  const [editSaving, setEditSaving] = useState(false)
  const [resetPwd, setResetPwd] = useState('') 
  const [selfCurrentPwd, setSelfCurrentPwd] = useState('')

  // Helpers: telefone BR simples (DDD + número)
  const digitsOnly = (s) => (s || '').replace(/\D/g, '')
  const formatBrPhone = (s) => {
    const d = digitsOnly(s).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
    if (d.length >= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    return d
  }

  // Groups (básico)
  const [groups, setGroups] = useState([]) 
  const [gName, setGName] = useState('') 
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [memberQuery, setMemberQuery] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [removeBulkLoading, setRemoveBulkLoading] = useState(false)
  // (Controles de seleção em massa removidos da aba Usuários)
  // Add-to-group (por usuário na lista)
  const [addToGroupUserId, setAddToGroupUserId] = useState(null)
  const [addToGroupGroupId, setAddToGroupGroupId] = useState('')
  const [addToGroupLoading, setAddToGroupLoading] = useState(false)
  // Toast simples
  const [toast, setToast] = useState(null) // { type: 'success'|'error'|'info', message: string }
  function showToast(message, type = 'info', ms = 3000) {
    setToast({ message, type })
    try { if (ms) setTimeout(() => setToast(null), ms) } catch {}
  }

  // Admin > Configurações (ícone do chat)
  const [cfgIcon, setCfgIcon] = useState('')
  const [cfgUrl, setCfgUrl] = useState('')
  const [globalIconUrl, setGlobalIconUrl] = useState('')
  // Admin > Configurações (senha do admin)
  const [admCurrentPwd, setAdmCurrentPwd] = useState('')
  const [admNewPwd, setAdmNewPwd] = useState('')
  const [admNewPwd2, setAdmNewPwd2] = useState('')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_icon')
      if (saved) { setCfgIcon(saved.startsWith('data:') ? saved : ''); setCfgUrl(saved.startsWith('data:') ? '' : saved) }
    } catch {}
    // Carrega ícone global do servidor
    (async () => { try { const pub = await (await fetch((import.meta.env.VITE_API_URL || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/public')).json(); if (pub?.chatIconUrl) setGlobalIconUrl(pub.chatIconUrl) } catch {} })()
  }, [])
  function onCfgFile(e){
    const f = e.target.files?.[0]; if (!f) return
    if (!f.type.startsWith('image/')) { showToast('Selecione uma imagem', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => { setCfgIcon(String(reader.result)); setCfgUrl('') }
    reader.readAsDataURL(f)
  }
  function saveCfg(e){
    e?.preventDefault?.()
    try {
      const val = (cfgUrl?.trim()) || cfgIcon
      if (!val) { showToast('Defina uma imagem ou URL', 'error'); return }
      localStorage.setItem('chat_icon', val)
      try { window.dispatchEvent(new Event('chat:iconUpdated')) } catch {}
      showToast('Configurações salvas', 'success')
    } catch { showToast('Falha ao salvar configurações', 'error') }
  }

  async function uploadGlobalIcon(file){
    if (!file) return
    const form = new FormData()
    form.append('icon', file)
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/icon', { method:'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: form })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha no upload') }
      const data = await res.json(); if (data?.chatIconUrl) { setGlobalIconUrl(data.chatIconUrl); showToast('Ícone global atualizado', 'success'); try { localStorage.setItem('chat_icon', data.chatIconUrl); window.dispatchEvent(new Event('chat:iconUpdated')) } catch {} }
    } catch(e){ showToast(e.message||'Falha ao enviar ícone', 'error') }
  }

  async function changeAdminPassword(e){
    e?.preventDefault?.();
    try {
      const current = (admCurrentPwd||'').trim();
      const password = (admNewPwd||'').trim();
      const confirm = (admNewPwd2||'').trim();
      if (!current) { showToast('Informe a senha atual', 'error'); return }
      if (password.length < 6) { showToast('Nova senha deve ter 6+ caracteres', 'error'); return }
      if (password !== confirm) { showToast('Confirmação não confere', 'error'); return }
      await api.post('/users/me/password', { current, password })
      setAdmCurrentPwd(''); setAdmNewPwd(''); setAdmNewPwd2('')
      showToast('Senha do admin alterada', 'success')
    } catch(e){ showToast(e.message||'Falha ao alterar senha', 'error') }
  }

  // Load lists (independentes)
  useEffect(() => { (async () => {
    try { const us = await api.get('/users'); setUsers(Array.isArray(us)?us:[]) } catch (e) { setError(prev=>prev? prev+' • Usuários: '+(e.message||'falha') : 'Usuários: '+(e.message||'falha')) }
  })() }, [])
  useEffect(() => { (async () => {
    try { const gs = await api.get('/groups/all?includeDMs=false'); setGroups(Array.isArray(gs)?gs:[]) } catch (e) { setError(prev=>prev? prev+' • Grupos: '+(e.message||'falha') : 'Grupos: '+(e.message||'falha')) }
  })() }, [])

  const filteredUsers = useMemo(()=>{ 
    const q = query.trim().toLowerCase() 
    if (!q) return users 
    return users.filter(u => (`${u.name} ${u.email}`.toLowerCase().includes(q))) 
  }, [users, query]) 
  const availableUsers = useMemo(()=> users.filter(u => !members.some(m => m.userId === u.id)), [users, members])
  const availableUsersFiltered = useMemo(()=>{
    const q = memberQuery.trim().toLowerCase()
    if (!q) return availableUsers
    return availableUsers.filter(u => (`${u.name} ${u.email}`.toLowerCase().includes(q)))
  }, [availableUsers, memberQuery])

  async function refreshUsers(){ try { const us = await api.get('/users'); setUsers(Array.isArray(us)?us:[]) } catch(e){} }

  async function createUser(e){
    e?.preventDefault?.(); setError('')
    const phoneFmt = formatBrPhone(uPhone)
    const phoneDigits = digitsOnly(phoneFmt)
    const addressTrim = (uAddress || '').trim()
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) return setError('Telefone inválido (use DDD + número).')

    const body = {
      name: uName.trim(),
      email: uEmail.trim(),
      password: uPassword,
      isAdmin: !!uIsAdmin,
      phone: phoneDigits ? phoneFmt : null,
      address: addressTrim || null,
    }
    if (!body.name || body.name.length<2) return setError('Informe um nome válido.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return setError('E-mail inválido.')
    if (!body.password || body.password.length<6) return setError('Senha com 6+ caracteres.')
    try {
      await api.post('/users', body)
      await refreshUsers()
      setUName(''); setUEmail(''); setUPassword(''); setUPhone(''); setUAddress(''); setUIsAdmin(false)
    } catch (e) { setError(e.message || 'Falha ao criar usuário') }
  }

  function openEdit(u){ setEditing({ ...u }); setResetPwd('') }
  function closeEdit(){ if (editSaving) return; setEditing(null); setResetPwd('') }
  async function saveEdit(e){ 
    e?.preventDefault?.(); if (!editing) return; setEditSaving(true); setError('') 
    try { 
      const phoneFmt = formatBrPhone(editing.phone || '')
      const phoneDigits = digitsOnly(phoneFmt)
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) throw new Error('Telefone inválido (use DDD + número).')
      const body = {
        name: (editing.name||'').trim(),
        email: (editing.email||'').trim(),
        phone: phoneDigits ? phoneFmt : null,
        address: (editing.address||'').trim() || null,
        isAdmin: !!editing.isAdmin,
        isBlocked: !!editing.isBlocked,
      }
      await api.patch(`/users/${editing.id}`, body) 
      if (resetPwd && resetPwd.trim().length>=6){ 
        if (me?.id && editing.id === me.id){ 
          if (!selfCurrentPwd.trim()) throw new Error('Informe a senha atual para alterar a sua senha.')
          await api.post(`/users/me/password`, { current: selfCurrentPwd.trim(), password: resetPwd.trim() })
        } else {
          await api.post(`/users/${editing.id}/password`, { password: resetPwd.trim() }) 
        }
      } 
      await refreshUsers(); closeEdit() 
    } catch (e) { setError(e.message || 'Falha ao salvar usuário') } finally { setEditSaving(false) } 
  } 
  async function deleteUser(id){ if (!confirm('Excluir este usuário?')) return; try { await api.del(`/users/${id}`); setUsers(prev=>prev.filter(u=>u.id!==id)); showToast('Usuário excluído', 'success') } catch(e){ showToast(e.message||'Falha ao excluir', 'error') } } 

  function openAddToGroup(u){ setAddToGroupUserId(u.id); setAddToGroupGroupId('') }
  function cancelAddToGroup(){ setAddToGroupUserId(null); setAddToGroupGroupId('') }
  async function confirmAddToGroup(){
    if (!addToGroupUserId || !addToGroupGroupId) return
    setAddToGroupLoading(true)
    try {
      await api.post(`/groups/${addToGroupGroupId}/members`, { userId: addToGroupUserId })
      // Se o painel de membros estiver aberto no mesmo grupo, atualiza
      if (selectedGroup?.id === addToGroupGroupId) await refreshMembers()
      cancelAddToGroup()
      showToast('Usuário adicionado ao grupo', 'success')
    } catch(e){ showToast(e.message || 'Falha ao adicionar ao grupo', 'error') } finally { setAddToGroupLoading(false) }
  }

  async function createGroup(e){ 
    e?.preventDefault?.(); setError('') 
    const name = (gName||'').trim(); if (name.length<2) return setError('Informe um nome de grupo com 2+ caracteres.') 
    try { await api.post('/groups', { name }); const gs = await api.get('/groups/all?includeDMs=false'); setGroups(Array.isArray(gs)?gs:[]); setGName('') } catch(e){ setError(e.message||'Falha ao criar grupo') } 
  } 

  // Telefonia (SIP)
  const [sipList, setSipList] = useState([])
  const [sipQuery, setSipQuery] = useState('')
  const [sipLoading, setSipLoading] = useState(false)
  const [sipError, setSipError] = useState('')
  const [sipUserId, setSipUserId] = useState('')
  const [sipDomain, setSipDomain] = useState('')
  const [sipExtension, setSipExtension] = useState('')
  const [sipPassword, setSipPassword] = useState('')
  const [sipSaving, setSipSaving] = useState(false)
  const [sipEditingId, setSipEditingId] = useState(null) // userId em edição
  const [sipEdit, setSipEdit] = useState({ domain: '', extension: '', password: '' })

  async function loadSip() {
    setSipLoading(true); setSipError('')
    try { const list = await api.get('/phone'); setSipList(Array.isArray(list)?list:[]) }
    catch(e){ setSipError(e.message||'Falha ao carregar contas SIP') }
    finally { setSipLoading(false) }
  }

  useEffect(() => { (async () => { try { await loadSip() } catch {} })() }, [])

  async function saveSip(e){
    e?.preventDefault?.(); setSipSaving(true)
    try {
      const uid = (sipUserId||'').trim()
      const domain = (sipDomain||'').trim()
      const extension = (sipExtension||'').trim()
      const password = (sipPassword||'').trim()
      if (!uid || !domain || !extension) { showToast('Informe usuário, domínio e ramal.', 'error'); return }
      await api.patch(`/phone/${uid}`, { domain, extension, ...(password?{password}: {}) })
      await loadSip(); setSipUserId(''); setSipDomain(''); setSipExtension(''); setSipPassword('')
      showToast('Conta SIP salva', 'success')
    } catch(e){ showToast(e.message||'Falha ao salvar conta SIP', 'error') } finally { setSipSaving(false) }
  }

  function openSipEdit(item){
    setSipEditingId(item.user.id)
    setSipEdit({ domain: item.domain||'', extension: item.extension||'', password: '' })
  }
  function cancelSipEdit(){ setSipEditingId(null); setSipEdit({ domain:'', extension:'', password:'' }) }
  async function saveSipEdit(){
    if (!sipEditingId) return; setSipSaving(true)
    try {
      const body = { domain: (sipEdit.domain||'').trim(), extension: (sipEdit.extension||'').trim() }
      if (!body.domain || !body.extension) { showToast('Domínio e ramal são obrigatórios.', 'error'); return }
      if ((sipEdit.password||'').trim()) body.password = (sipEdit.password||'').trim()
      await api.patch(`/phone/${sipEditingId}`, body)
      await loadSip(); cancelSipEdit(); showToast('Conta SIP atualizada', 'success')
    } catch(e){ showToast(e.message||'Falha ao atualizar conta SIP', 'error') } finally { setSipSaving(false) }
  }

  async function disconnectSip(userId){
    try { await api.post(`/phone/${userId}/disconnect`, {}); await loadSip(); showToast('Desconectado', 'success') } catch(e){ showToast(e.message||'Falha ao desconectar', 'error') }
  }

  async function deleteSip(userId){
    try {
      if (typeof window !== 'undefined'){
        const ok = window.confirm('Excluir ramal/conta SIP deste usuário?')
        if (!ok) return
      }
      await api.delete(`/phone/${userId}`)
      await loadSip()
      showToast('Ramal excluído', 'success')
    } catch(e){ showToast(e.message||'Falha ao excluir ramal', 'error') }
  }

  async function openGroup(g){
    setSelectedGroup(g)
    setMemberQuery('')
    setSelectedUserToAdd('')
    setSelectedMemberIds([])
    try { const ms = await api.get(`/groups/${g.id}/members`); setMembers(Array.isArray(ms)?ms:[]) } catch(e){ setMembers([]); setError(e.message||'Falha ao carregar membros') }
  }

  async function deleteGroup(groupId){
    if (!groupId) return
    try {
      // Bloqueia exclusão se houver membros
      if (selectedGroup?.id === groupId) {
        if (members.length > 0) { showToast('Remova todos os membros antes de excluir o grupo.', 'error'); return }
      } else {
        try {
          const ms = await api.get(`/groups/${groupId}/members`)
          if (Array.isArray(ms) && ms.length > 0) { showToast('Remova todos os membros antes de excluir o grupo.', 'error'); return }
        } catch {}
      }
      if (typeof window !== 'undefined') {
        const ok = window.confirm('Excluir este grupo? Esta ação não pode ser desfeita.')
        if (!ok) return
      }
      await api.delete(`/groups/${groupId}`)
      setGroups(prev => prev.filter(g => g.id !== groupId))
      if (selectedGroup?.id === groupId) { setSelectedGroup(null); setMembers([]) }
      showToast('Grupo excluído', 'success')
    } catch(e){ showToast(e.message || 'Falha ao excluir grupo', 'error') }
  }

  async function refreshMembers(){ if (!selectedGroup) return; try { const ms = await api.get(`/groups/${selectedGroup.id}/members`); setMembers(Array.isArray(ms)?ms:[]) } catch(e){} }

  async function addMember(){
    if (!selectedGroup || !selectedUserToAdd) return
    setAddingMember(true)
    try {
      await api.post(`/groups/${selectedGroup.id}/members`, { userId: selectedUserToAdd })
      setSelectedUserToAdd('')
      await refreshMembers()
    } catch(e){ showToast(e.message || 'Falha ao adicionar membro', 'error') } finally { setAddingMember(false) }
  }

  async function removeMember(userId){
    if (!selectedGroup) return
    try { await api.delete(`/groups/${selectedGroup.id}/members/${userId}`); setMembers(prev=>prev.filter(m=>m.userId!==userId)) } catch(e){ showToast(e.message||'Falha ao remover', 'error') }
  }

  function toggleSelectMember(userId){
    setSelectedMemberIds(prev => prev.includes(userId) ? prev.filter(id=>id!==userId) : [...prev, userId])
  }
  function selectAllMembers(){ setSelectedMemberIds(members.map(m=>m.userId)) }
  function clearMemberSelection(){ setSelectedMemberIds([]) }
  async function removeSelectedMembers(){
    if (!selectedGroup || !selectedMemberIds.length) return
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Remover ${selectedMemberIds.length} membro(s) de ${selectedGroup.name}?`)
      if (!ok) return
    }
    setRemoveBulkLoading(true)
    try {
      const tasks = selectedMemberIds.map(id => api.delete(`/groups/${selectedGroup.id}/members/${id}`))
      const results = await Promise.allSettled(tasks)
      const ok = results.filter(r=>r.status==='fulfilled').length
      const fail = results.length - ok
      if (ok) await refreshMembers()
      clearMemberSelection()
      if (fail) showToast(`Removidos: ${ok}. Falhas: ${fail}.`, 'error')
      else showToast(`Removidos: ${ok}.`, 'success')
    } catch(e){ showToast(e.message||'Falha ao remover seleção', 'error') } finally { setRemoveBulkLoading(false) }
  }

  return (
    <div className="p-4 overflow-auto h-full"> 
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded shadow border text-sm ${toast.type==='success'?'bg-green-50 text-green-800 border-green-200':toast.type==='error'?'bg-red-50 text-red-800 border-red-200':'bg-slate-50 text-slate-800 border-slate-200'}`}>
          {toast.message}
        </div>
      )}
      <h2 className="text-2xl font-semibold">Admin</h2>
      <div className="mt-3 border-b border-slate-200">
        <div className="flex gap-4"> 
          <button onClick={()=>setTab('usuarios')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='usuarios'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Usuários</button> 
          <button onClick={()=>setTab('grupos')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='grupos'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Grupos</button> 
          <button onClick={()=>setTab('telefonia')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='telefonia'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Telefonia</button> 
          <button onClick={()=>setTab('configuracoes')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='configuracoes'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Configurações</button> 
        </div> 
      </div> 

      {error && <div className="mt-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</div>}

      {tab==='usuarios' && (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <form onSubmit={createUser} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2">
            <h4 className="font-medium">Novo Usuário</h4>
            <input className="border rounded px-3 py-2" placeholder="Nome" value={uName} onChange={e=>setUName(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="E-mail" value={uEmail} onChange={e=>setUEmail(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Telefone (opcional)" value={uPhone} onChange={e=>setUPhone(formatBrPhone(e.target.value))} />
            <input className="border rounded px-3 py-2" placeholder="Endereço (opcional)" value={uAddress} onChange={e=>setUAddress(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Senha" type="password" value={uPassword} onChange={e=>setUPassword(e.target.value)} />
            <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={uIsAdmin} onChange={e=>setUIsAdmin(e.target.checked)} /> Admin</label>
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
          </form>

          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Lista</h4>
              <div className="flex items-center gap-2">
                <input className="border rounded px-2 py-1 text-sm" placeholder="Buscar..." value={query} onChange={e=>setQuery(e.target.value)} />
                
                <button className="px-2 py-1 text-sm rounded border hover:bg-slate-50" onClick={refreshUsers}>Atualizar</button>
              </div>
            </div>
            {filteredUsers.length ? (
              <ul className="mt-2 divide-y divide-slate-200">
                {filteredUsers.map(u=> (
                  <li key={u.id} className="py-2 flex items-center justify-between"> 
                    <div className="min-w-0"> 
                      <div className="font-medium truncate">{u.name}</div> 
                      <div className="text-xs text-slate-500 truncate">{u.email}</div> 
                      <div className="text-xs text-slate-500">{u.isAdmin ? 'admin' : ''}{u.isBlocked ? (u.isAdmin?' • ':'')+'bloqueado' : ''}</div> 
                    </div> 
                    <div className="shrink-0 flex items-center gap-3"> 
                      <button className="px-2 py-1 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>openEdit(u)}>Editar</button> 
                      <button className="px-2 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={()=>deleteUser(u.id)}>Excluir</button> 
                      <div className="relative inline-block">
                        {addToGroupUserId === u.id ? (
                          <div className="flex items-center gap-2">
                            <select className="border rounded px-2 py-1 text-sm" value={addToGroupGroupId} onChange={e=>setAddToGroupGroupId(e.target.value)}>
                              <option value="">Escolha o grupo</option>
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                            <button className="px-2 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60" disabled={!addToGroupGroupId || addToGroupLoading} onClick={confirmAddToGroup}>{addToGroupLoading?'Adicionando...':'Adicionar'}</button>
                            <button className="px-2 py-1 text-sm rounded border" onClick={cancelAddToGroup}>Cancelar</button>
                          </div>
                        ) : (
                          <button className="px-2 py-1 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50" onClick={()=>openAddToGroup(u)}>Adicionar ao grupo</button>
                        )}
                      </div>
                    </div> 
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
            {groups.length ? (
              <ul className="mt-2 space-y-1">
                {groups.map(g=> ( 
                  <li 
                    key={g.id} 
                    className={`px-2 py-1 rounded border cursor-pointer ${selectedGroup?.id===g.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    onClick={()=>openGroup(g)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{g.name}</span>
                      {(() => { const disable = selectedGroup?.id===g.id && members.length>0; return (
                        <button
                          type="button"
                          className={`px-2 py-1 text-sm rounded border ml-3 border-red-300 text-red-700 ${disable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'}`}
                          disabled={disable}
                          title={disable ? 'Remova todos os membros antes de excluir' : 'Excluir'}
                          onClick={(e)=>{ e.stopPropagation(); if (!disable) deleteGroup(g.id) }}
                        >Excluir</button>
                      ) })()}
                    </div>
                  </li> 
                ))} 
              </ul> 
            ) : ( 
              <div className="mt-2 text-sm text-slate-500">Nenhum grupo encontrado.</div> 
            )} 
          </div> 
          {selectedGroup && (
            <div className="bg-white p-4 rounded border border-slate-200 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Membros · {selectedGroup.name}</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`text-xs rounded border px-2 py-1 border-red-300 text-red-700 ${members.length>0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'}`}
                    disabled={members.length>0}
                    title={members.length>0 ? 'Remova todos os membros antes de excluir' : 'Excluir grupo'}
                    onClick={()=>{ if (members.length===0) deleteGroup(selectedGroup.id) }}
                  >Excluir grupo</button>
                  <button type="button" className="text-xs rounded border px-2 py-1 hover:bg-slate-50" onClick={selectAllMembers}>Selecionar todos</button>
                  <button type="button" className="text-xs rounded border px-2 py-1 hover:bg-slate-50" onClick={clearMemberSelection}>Limpar seleção</button>
                  <button type="button" className="text-xs rounded bg-red-600 text-white px-2 py-1 disabled:opacity-60" disabled={!selectedMemberIds.length || removeBulkLoading} onClick={removeSelectedMembers}>{removeBulkLoading?'Removendo...':'Remover seleção'}</button>
                  <button type="button" className="text-xs text-slate-600 underline" onClick={refreshMembers}>Atualizar</button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Buscar usuário..." value={memberQuery} onChange={e=>setMemberQuery(e.target.value)} />
                <select className="border rounded px-2 py-1 text-sm" value={selectedUserToAdd} onChange={e=>setSelectedUserToAdd(e.target.value)}>
                  <option value="">Selecionar usuário</option>
                  {availableUsersFiltered.map(u=> (
                    <option key={u.id} value={u.id}>{u.name} • {u.email}</option>
                  ))}
                </select>
                <button type="button" className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60" disabled={!selectedUserToAdd || addingMember} onClick={addMember}>{addingMember?'Adicionando...':'Adicionar'}</button>
              </div>
              {members.length ? (
                <ul className="mt-3 divide-y divide-slate-200">
                  {members.map(m => (
                    <li key={m.userId} className="py-2 flex items-center justify-between">
                      <div className="min-w-0 flex items-center gap-2">
                        <input type="checkbox" checked={selectedMemberIds.includes(m.userId)} onChange={()=>toggleSelectMember(m.userId)} />
                        <div>
                          <div className="font-medium truncate">{m.user?.name || m.userId}</div>
                          <div className="text-xs text-slate-500 truncate">{m.user?.email}</div>
                        </div>
                      </div>
                      <button type="button" className="px-2 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={()=>removeMember(m.userId)}>Remover</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Sem membros ainda.</div>
              )}
            </div>
          )}
        </section> 
      )} 

      {tab==='telefonia' && (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <form onSubmit={saveSip} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2 md:col-span-1">
            <h4 className="font-medium">Nova/Atualizar conta SIP</h4>
            <select className="border rounded px-3 py-2" value={sipUserId} onChange={e=>setSipUserId(e.target.value)}>
              <option value="">Selecione o usuário</option>
              {users.map(u => (<option key={u.id} value={u.id}>{u.name} • {u.email}</option>))}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Domínio (ex.: sip.empresa.com)" value={sipDomain} onChange={e=>setSipDomain(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Ramal/Extensão" value={sipExtension} onChange={e=>setSipExtension(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Senha (opcional para manter)" type="password" value={sipPassword} onChange={e=>setSipPassword(e.target.value)} />
            <button disabled={sipSaving} className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 disabled:opacity-60">{sipSaving?'Salvando...':'Salvar conta SIP'}</button>
          </form>

          <div className="bg-white p-4 rounded border border-slate-200 md:col-span-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Contas SIP</h4>
              <div className="flex items-center gap-2">
                <input className="border rounded px-2 py-1 text-sm w-64 shrink-0" placeholder="Buscar por nome, e-mail, ramal, domínio" value={sipQuery} onChange={e=>setSipQuery(e.target.value)} />
                <button type="button" className="px-2 py-1 text-sm rounded border hover:bg-slate-50" onClick={loadSip}>Atualizar</button>
              </div>
            </div>
            {sipError && <div className="mt-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{sipError}</div>}
            {sipLoading ? (
              <div className="mt-2 text-sm text-slate-500">Carregando...</div>
            ) : sipList.length ? (
              <ul className="mt-2 divide-y divide-slate-200">
                {sipList.filter(a => {
                  const q = sipQuery.trim().toLowerCase()
                  if (!q) return true
                  const hay = `${a.user?.name||''} ${a.user?.email||''} ${a.extension||''} ${a.domain||''}`.toLowerCase()
                  return hay.includes(q)
                }).map(a => (
                  <li key={a.id} className="py-2">
                    {sipEditingId === a.user.id ? (
                      <div className="grid md:grid-cols-6 gap-2 items-center">
                        <div className="md:col-span-2 min-w-0">
                          <div className="font-medium truncate">{a.user?.name}</div>
                          <div className="text-xs text-slate-500 truncate">{a.user?.email}</div>
                        </div>
                        <input className="border rounded px-2 py-1 text-sm" placeholder="Domínio" value={sipEdit.domain} onChange={e=>setSipEdit(prev=>({...prev, domain:e.target.value}))} />
                        <input className="border rounded px-2 py-1 text-sm" placeholder="Ramal" value={sipEdit.extension} onChange={e=>setSipEdit(prev=>({...prev, extension:e.target.value}))} />
                        <input className="border rounded px-2 py-1 text-sm" placeholder="Senha (opcional)" type="password" value={sipEdit.password} onChange={e=>setSipEdit(prev=>({...prev, password:e.target.value}))} />
                        <div className="flex items-center gap-2 justify-end whitespace-nowrap">
                          <button className="px-2 py-1 text-sm rounded border" onClick={cancelSipEdit} disabled={sipSaving}>Cancelar</button>
                          <button className="px-2 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60" onClick={saveSipEdit} disabled={sipSaving}>Salvar</button>
                          <button className="px-2 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={()=>deleteSip(a.user.id)} disabled={sipSaving}>Excluir</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-6 gap-2 items-center">
                        <div className="md:col-span-2 min-w-0">
                          <div className="font-medium truncate">{a.user?.name}</div>
                          <div className="text-xs text-slate-500 truncate">{a.user?.email}</div>
                        </div>
                        <div className="text-sm truncate">{a.domain}</div>
                        <div className="text-sm">{a.extension}</div>
                        <div className="text-xs">
                          <span className={`px-2 py-0.5 rounded-full border ${a.regRegistered? 'bg-green-50 text-green-700 border-green-200':'bg-slate-50 text-slate-600 border-slate-200'}`}>{a.regRegistered? 'registrado' : (a.regStatus || 'desconectado')}</span>
                        </div>
                        <div className="flex items-center gap-3 justify-end whitespace-nowrap">
                          <button className="px-2 py-1 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>openSipEdit(a)}>Editar</button>
                          <button className="px-2 py-1 text-sm rounded border border-amber-300 text-amber-700 hover:bg-amber-50" onClick={()=>disconnectSip(a.user.id)}>Desconectar</button>
                          <button className="px-2 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={()=>deleteSip(a.user.id)}>Excluir</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Nenhuma conta SIP encontrada.</div>
            )}
          </div>
        </section>
      )}

      {tab==='configuracoes' && (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <form onSubmit={saveCfg} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2">
            <h4 className="font-medium">Aparência</h4>
            <label className="text-sm text-slate-700">Ícone do chat</label>
            <div className="flex items-center gap-2">
              <input ref={el=>window.__cfgFileRef=el} id="cfg-file" className="hidden" type="file" accept="image/*" onChange={onCfgFile} />
              <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>document.getElementById('cfg-file')?.click()}>Escolher imagem</button>
              {(cfgIcon||cfgUrl) && <button type="button" className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={()=>{ setCfgIcon(''); setCfgUrl('') }}>Remover</button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-slate-500">Preview</div>
                { (cfgIcon || cfgUrl) ? (
                  <img src={cfgIcon || cfgUrl} alt="ícone" className="mt-1 w-12 h-12 rounded-full object-cover border" />
                ) : (
                  <div className="mt-1 w-12 h-12 rounded-full border bg-slate-100" />
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500">URL (opcional)</div>
                <input className="border rounded px-3 py-2 w-full" placeholder="https://..." value={cfgUrl} onChange={e=>{ setCfgUrl(e.target.value); if (e.target.value) setCfgIcon('') }} />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button type="button" className="px-3 py-2 rounded border" onClick={()=>{ setCfgIcon(''); setCfgUrl('') }}>Limpar</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white">Salvar</button>
            </div>
          </form>
          <div className="bg-white p-4 rounded border border-slate-200 text-sm text-slate-600">
            <h4 className="font-medium text-slate-900">Sobre as Configurações</h4>
            <p className="mt-2">Estas configurações são salvas no navegador (localStorage) e afetam apenas esta instância/usuário. Para definir o ícone globalmente para todos, podemos evoluir para salvar no servidor.</p>
          </div>
          <div className="bg-white p-4 rounded border border-slate-200 md:col-span-2">
            <h4 className="font-medium">Ícone Global (servidor)</h4>
            <div className="mt-2 flex items-center gap-3">
              {globalIconUrl ? (
                <img src={globalIconUrl} alt="global" className="w-12 h-12 rounded-full object-cover border" />
              ) : (
                <div className="w-12 h-12 rounded-full border bg-slate-100" />
              )}
              <div className="flex items-center gap-2">
                <input id="cfg-file-global" className="hidden" type="file" accept="image/*" onChange={e=>uploadGlobalIcon(e.target.files?.[0])} />
                <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>document.getElementById('cfg-file-global')?.click()}>Enviar e definir global</button>
                {globalIconUrl && <button type="button" className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>{ try{ localStorage.setItem('chat_icon', globalIconUrl); window.dispatchEvent(new Event('chat:iconUpdated')); showToast('Aplicado ícone global neste navegador', 'success') } catch{} }}>Usar este ícone</button>}
              </div>
            </div>
          </div>
          <form onSubmit={changeAdminPassword} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2 md:col-span-2">
            <h4 className="font-medium">Alterar senha do administrador</h4>
            <div className="grid md:grid-cols-3 gap-2">
              <input className="border rounded px-3 py-2" placeholder="Senha atual" type="password" value={admCurrentPwd} onChange={e=>setAdmCurrentPwd(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Nova senha (6+)" type="password" value={admNewPwd} onChange={e=>setAdmNewPwd(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Confirmar nova senha" type="password" value={admNewPwd2} onChange={e=>setAdmNewPwd2(e.target.value)} />
            </div>
            <div className="flex items-center justify-end">
              <button className="px-3 py-2 rounded bg-blue-600 text-white">Alterar senha</button>
            </div>
          </form>
        </section>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={closeEdit}>
          <div className="bg-white w-full max-w-lg rounded border border-slate-200 p-4" onClick={e=>e.stopPropagation()}>
            <h4 className="text-lg font-medium mb-2">Editar Usuário</h4>
            <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Nome" value={editing.name||''} onChange={e=>setEditing(prev=>({...prev, name:e.target.value}))} />
              <input className="border rounded px-3 py-2" placeholder="E-mail" value={editing.email||''} onChange={e=>setEditing(prev=>({...prev, email:e.target.value}))} />
              <input className="border rounded px-3 py-2" placeholder="Telefone" value={editing.phone||''} onChange={e=>setEditing(prev=>({...prev, phone: formatBrPhone(e.target.value)}))} />
              <input className="border rounded px-3 py-2" placeholder="Endereço" value={editing.address||''} onChange={e=>setEditing(prev=>({...prev, address:e.target.value}))} />
              <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!editing.isAdmin} onChange={e=>setEditing(prev=>({...prev, isAdmin:e.target.checked}))} /> Admin</label>
              <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" checked={!!editing.isBlocked} onChange={e=>setEditing(prev=>({...prev, isBlocked:e.target.checked}))} /> Bloqueado</label>
              {me?.id && editing.id === me.id && (
                <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Senha atual (obrigatória para trocar a sua senha)" type="password" value={selfCurrentPwd} onChange={e=>setSelfCurrentPwd(e.target.value)} />
              )}
              <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Nova senha (opcional, 6+)" type="password" value={resetPwd} onChange={e=>setResetPwd(e.target.value)} />
              <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
                <button type="button" className="px-3 py-2 rounded border" onClick={closeEdit} disabled={editSaving}>Cancelar</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60" disabled={editSaving}>{editSaving?'Salvando...':'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
