import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react' 
import { getUser, getToken } from '../state/auth.js'
import { api, API_BASE } from '../services/api.js'

export default function Admin() { 
  const me = getUser()
  const [tab, setTab] = useState('usuarios') // 'usuarios' | 'grupos' | 'telefonia' | 'Configuracoes'
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
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  function showToast(message, type = 'info', ms = 3000) {
    setToast({ message, type })
    try { if (ms) setTimeout(() => setToast(null), ms) } catch {}
  }
  const formatDateTime = useCallback((value) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString('pt-BR')
    } catch {
      return value
    }
  }, [])
  const formatBytes = useCallback((value) => {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return '—'
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
    const num = bytes / Math.pow(1024, exponent)
    const formatted = num >= 10 ? num.toFixed(0) : num.toFixed(1)
    return `${formatted} ${units[exponent]}`
  }, [])

  const formatNumber = useCallback((value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString('pt-BR')
  }, [])
  const formatDecimal = useCallback((value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }, [])
  const metricsTimeline = useMemo(() => {
    const list = Array.isArray(metrics?.recentTimeline) ? metrics.recentTimeline : []
    const max = Math.max(1, list.reduce((acc, bucket) => Math.max(acc, bucket?.count || 0), 0))
    return { list, max }
  }, [metrics])

  // Admin > Configurações (ícone do chat)
  const [cfgIcon, setCfgIcon] = useState('')
  const [cfgUrl, setCfgUrl] = useState('')
  const [globalIconUrl, setGlobalIconUrl] = useState('')
  const [globalWallpaperUrl, setGlobalWallpaperUrl] = useState('')
  const [loginLogoUrl, setLoginLogoUrl] = useState('')
  const [loginLogoUploading, setLoginLogoUploading] = useState(false)
  const [loginLogoDeleting, setLoginLogoDeleting] = useState(false)
  const [loginLogoSaving, setLoginLogoSaving] = useState(false)
  const [alertSounds, setAlertSounds] = useState([])
  const [activeAlertSoundId, setActiveAlertSoundId] = useState(null)
  const [soundName, setSoundName] = useState('')
  const [soundUploading, setSoundUploading] = useState(false)
  const [soundDeletingId, setSoundDeletingId] = useState('')
  const soundInputRef = useRef(null)
  const previewAudioRef = useRef(null)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpFrom, setSmtpFrom] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const defaultBackupSettings = useMemo(() => ({
    autoEnabled: false,
    time: '02:00',
    retentionDays: 7,
    lastAutoRunAt: null,
    lastManualRunAt: null,
    lastManualResult: null,
    lastAutoResult: null,
    lastRestoreAt: null,
    lastRestoreName: null,
    lastRestoreActor: null,
  }), [])
  const [backups, setBackups] = useState([])
  const [backupSettings, setBackupSettings] = useState(defaultBackupSettings)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupRunning, setBackupRunning] = useState(false)
  const [backupRestoring, setBackupRestoring] = useState('')
  const [backupDeleting, setBackupDeleting] = useState('')
  const [backupDownloading, setBackupDownloading] = useState('')
  const [backupSavingSettings, setBackupSavingSettings] = useState(false)
  // Admin > Configurações (papel de parede das Conversas)
  const [cfgBg, setCfgBg] = useState(() => {
    try { return localStorage.getItem('chat_bg') || 'default' } catch { return 'default' }
  })
  // Admin > Configurações (senha do admin)
  const [admCurrentPwd, setAdmCurrentPwd] = useState('')
  const [admNewPwd, setAdmNewPwd] = useState('')
  const [admNewPwd2, setAdmNewPwd2] = useState('')
  function syncGlobalSound(list, activeId) {
    if (typeof window === 'undefined') return
    try {
      const items = Array.isArray(list) ? list : []
      if (activeId) {
        const active = items.find((item) => item.id === activeId)
        if (active?.url) {
          localStorage.setItem('notif_sound_url', active.url)
          window.dispatchEvent(new Event('chat:alertSoundUpdated'))
          return
        }
      }
      localStorage.removeItem('notif_sound_url')
      window.dispatchEvent(new Event('chat:alertSoundUpdated'))
    } catch {}
  }

  async function loadAdminConfig({ silent } = {}) {
    try {
      const cfg = await api.get('/admin/config')
      setGlobalIconUrl(cfg?.chatIconUrl || '')
      setGlobalWallpaperUrl(cfg?.chatWallpaperUrl || '')
      setLoginLogoUrl(cfg?.loginLogoUrl || '')
      const list = Array.isArray(cfg?.alertSounds) ? cfg.alertSounds : []
      setAlertSounds(list)
      setActiveAlertSoundId(cfg?.activeAlertSoundId || null)
      syncGlobalSound(list, cfg?.activeAlertSoundId || null)
      setSmtpHost(cfg?.smtp?.host || '')
      setSmtpPort(cfg?.smtp?.port ? String(cfg.smtp.port) : '')
      setSmtpSecure(cfg?.smtp?.secure ?? false)
      setSmtpUser(cfg?.smtp?.user || '')
      setSmtpFrom(cfg?.smtp?.from || '')
      setSmtpPassword('')
      setSmtpPasswordSet(!!cfg?.smtpPasswordSet)
    } catch (e) {
      if (!silent) showToast(e.message || 'Falha ao carregar configurações', 'error')
    }
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_icon')
      if (saved) { setCfgIcon(saved.startsWith('data:') ? saved : ''); setCfgUrl(saved.startsWith('data:') ? '' : saved) }
    } catch {}
    // Carrega ícone global do servidor
    (async () => { try { const pub = await (await fetch((import.meta.env.VITE_API_URL || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + `/admin/config/public?_=${Date.now()}`, { cache:'no-store' })).json(); if (pub?.chatIconUrl) setGlobalIconUrl(pub.chatIconUrl); if (pub?.chatWallpaperUrl) setGlobalWallpaperUrl(pub.chatWallpaperUrl); if (Object.prototype.hasOwnProperty.call(pub||{}, 'loginLogoUrl')) setLoginLogoUrl(pub?.loginLogoUrl || '') } catch {} })()
    ;(async () => {
      try { await loadAdminConfig({ silent: true }) } catch {}
    })()
  }, [])
  const loadMetrics = useCallback(async () => {
    setMetricsError('')
    setMetricsLoading(true)
    try {
      const data = await api.get('/admin/metrics')
      setMetrics(data)
    } catch (err) {
      setMetricsError(err.message || 'Falha ao carregar metricas')
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
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
      // Salva papel de parede das conversas
      try {
        localStorage.setItem('chat_bg', cfgBg || 'default')
        document.body?.setAttribute?.('data-chat-bg', cfgBg || 'default')
        window.dispatchEvent(new Event('chat:bgUpdated'))
      } catch {}
      showToast('Configurações salvas', 'success')
    } catch { showToast('Falha ao salvar configurações', 'error') }
  }

  async function uploadGlobalIcon(file){
    if (!file) return
    const form = new FormData()
    form.append('icon', file)
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/icon', { method:'POST', headers: { Authorization: `Bearer ${getToken()||''}` }, body: form })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha no upload') }
      const data = await res.json(); if (data?.chatIconUrl) { setGlobalIconUrl(data.chatIconUrl); showToast('Ícone global atualizado', 'success'); try { localStorage.setItem('chat_icon', data.chatIconUrl); window.dispatchEvent(new Event('chat:iconUpdated')) } catch {} }
    } catch(e){ showToast(e.message||'Falha ao enviar ícone', 'error') }
  }

  async function uploadGlobalWallpaper(file){
    if (!file) return
    const form = new FormData()
    form.append('wallpaper', file)
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/wallpaper', { method:'POST', headers: { Authorization: `Bearer ${getToken()||''}` }, body: form })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha no upload') }
      const data = await res.json(); if (data?.chatWallpaperUrl) { setGlobalWallpaperUrl(data.chatWallpaperUrl); document.documentElement.style.setProperty('--chat-wallpaper', `url('${data.chatWallpaperUrl}')`); try { localStorage.setItem('chat_wallpaper', data.chatWallpaperUrl); window.dispatchEvent(new Event('chat:wallpaperUpdated')) } catch {} ; showToast('Papel de parede global atualizado', 'success') }
    } catch(e){ showToast(e.message||'Falha ao enviar papel de parede', 'error') }
  }
  async function uploadLoginLogo(file){
    if (!file) return
    if (!file.type?.startsWith('image/')) { showToast('Selecione uma imagem', 'error'); return }
    setLoginLogoUploading(true)
    const form = new FormData()
    form.append('loginLogo', file)
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/login-logo', { method:'POST', headers: { Authorization: `Bearer ${getToken()||''}` }, body: form })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha no upload') }
      const data = await res.json()
      setLoginLogoUrl(data?.loginLogoUrl || '')
      showToast('Logo do login atualizada', 'success')
    } catch(e){ showToast(e.message||'Falha ao enviar logo do login', 'error') }
    finally { setLoginLogoUploading(false) }
  }
  async function saveLoginLogo(){
    setLoginLogoSaving(true)
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config', {
        method:'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${getToken()||''}` },
        body: JSON.stringify({ loginLogoUrl: loginLogoUrl || null }),
      })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha ao salvar') }
      showToast('Logo do login salva', 'success')
    } catch(e){ showToast(e.message||'Falha ao salvar logo do login', 'error') }
    finally { setLoginLogoSaving(false) }
  }
  async function saveGlobalWallpaper(){
    try {
      if (!globalWallpaperUrl) { showToast('Nenhum papel de parede para salvar', 'error'); return }
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config', {
        method:'PATCH',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${getToken()||''}` },
        body: JSON.stringify({ chatWallpaperUrl: globalWallpaperUrl })
      })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha ao salvar') }
      showToast('Papel de parede salvo para todos', 'success')
    } catch(e){ showToast(e.message||'Falha ao salvar papel de parede', 'error') }
  }
  async function deleteLoginLogo(){
    try {
      const ok = typeof window!=='undefined' ? window.confirm('Excluir Logo da tela de login?') : true
      if (!ok) return
      setLoginLogoDeleting(true)
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/login-logo', {
        method:'DELETE',
        headers: { Authorization: `Bearer ${getToken()||''}` },
      })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha ao excluir') }
      setLoginLogoUrl('')
      showToast('Logo do login excluída', 'success')
    } catch(e){ showToast(e.message||'Falha ao excluir logo do login', 'error') }
    finally { setLoginLogoDeleting(false) }
  }
  async function deleteGlobalWallpaper(){
    try {
      const ok = typeof window!=='undefined' ? window.confirm('Excluir papel de parede global?') : true
      if (!ok) return
      const res = await fetch(((import.meta.env.VITE_API_URL) || (typeof window!=='undefined'? `${window.location.origin}/api` : 'http://localhost:3000/api')) + '/admin/config/wallpaper', {
        method:'DELETE',
        headers: { Authorization: `Bearer ${getToken()||''}` },
      })
      if (!res.ok) { const t = await res.text(); throw new Error(t||'Falha ao excluir') }
      setGlobalWallpaperUrl('')
      // Limpa aplicação local caso estivesse usando o global
      try { localStorage.removeItem('chat_wallpaper'); document.documentElement.style.removeProperty('--chat-wallpaper'); window.dispatchEvent(new Event('chat:wallpaperUpdated')) } catch {}
      showToast('Papel de parede global excluído', 'success')
    } catch(e){ showToast(e.message||'Falha ao excluir papel de parede', 'error') }
  }

  async function saveEmailConfig(){
    if (emailSaving) return
    setEmailSaving(true)
    try {
      const payload = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        from: smtpFrom,
      }
      if (smtpPassword) payload.password = smtpPassword
      await api.patch('/admin/config/email', payload)
      await loadAdminConfig({ silent: true })
      showToast('Configurações de e-mail salvas', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao salvar e-mail', 'error')
    } finally {
      setEmailSaving(false)
    }
  }

  async function testEmailConfig(){
    if (smtpTesting) return
    setSmtpTesting(true)
    try {
      await api.post('/admin/config/email/test', {})
      showToast('SMTP verificado com sucesso', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao verificar SMTP', 'error')
    } finally {
      setSmtpTesting(false)
    }
  }

  const loadBackups = useCallback(async () => {
    setBackupLoading(true)
    try {
      const data = await api.get('/admin/backup')
      setBackups(Array.isArray(data?.backups) ? data.backups : [])
      const nextSettings = { ...defaultBackupSettings, ...(data?.settings || {}) }
      setBackupSettings(nextSettings)
    } catch (e) {
      showToast(e.message || 'Falha ao carregar backups', 'error')
    } finally {
      setBackupLoading(false)
    }
  }, [defaultBackupSettings])

  async function runBackupNow() {
    setBackupRunning(true)
    try {
      await api.post('/admin/backup/run', {})
      showToast('Backup criado com sucesso', 'success')
      await loadBackups()
    } catch (e) {
      showToast(e.message || 'Falha ao executar backup', 'error')
    } finally {
      setBackupRunning(false)
    }
  }

  async function restoreBackupName(name) {
    if (!name) return
    let ok = true
    if (typeof window !== 'undefined') {
      ok = window.confirm(`Restaurar o backup "${name}"? Esta ação substituirá mensagens e arquivos atuais.`)
    }
    if (!ok) return
    setBackupRestoring(name)
    try {
      await api.post('/admin/backup/restore', { name, confirm: true })
      showToast('Backup restaurado com sucesso', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao restaurar backup', 'error')
    } finally {
      setBackupRestoring('')
      await loadBackups()
    }
  }

  async function deleteBackupName(name) {
    if (!name) return
    let ok = true
    if (typeof window !== 'undefined') {
      ok = window.confirm(`Excluir backup "${name}"?`)
    }
    if (!ok) return
    setBackupDeleting(name)
    try {
      await api.delete(`/admin/backup/${encodeURIComponent(name)}`)
      showToast('Backup excluído', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao excluir backup', 'error')
    } finally {
      setBackupDeleting('')
      await loadBackups()
    }
  }

  async function downloadBackup(name) {
    if (!name) return
    setBackupDownloading(name)
    try {
      const res = await fetch(`${API_BASE}/admin/backup/download/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Falha ao preparar download')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${name}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      showToast(e.message || 'Falha ao baixar backup', 'error')
    } finally {
      setBackupDownloading('')
    }
  }

  async function saveBackupSchedule(e) {
    e?.preventDefault?.()
    setBackupSavingSettings(true)
    try {
      const payload = {
        autoEnabled: backupSettings.autoEnabled,
        time: backupSettings.time,
        retentionDays: backupSettings.retentionDays,
      }
      const data = await api.post('/admin/backup/settings', payload)
      const nextSettings = { ...defaultBackupSettings, ...(data?.settings || payload) }
      setBackupSettings(nextSettings)
      showToast('Configurações de backup salvas', 'success')
    } catch (err) {
      showToast(err.message || 'Falha ao salvar configurações de backup', 'error')
    } finally {
      setBackupSavingSettings(false)
    }
  }

  useEffect(() => {
    if (tab === 'Configuracoes') {
      loadBackups()
    }
  }, [tab, loadBackups])

  useEffect(() => {
    if (tab === 'metricas') {
      loadMetrics()
    }
  }, [tab, loadMetrics])


  function triggerSoundUpload() {
    try { soundInputRef.current?.click?.() } catch {}
  }

  async function onSoundSelected(e) {
    const file = e?.target?.files?.[0]
    if (!file) return
    if (file.type && !file.type.startsWith('audio/')) {
      showToast('Selecione um arquivo de áudio', 'error')
      if (e?.target) e.target.value = ''
      return
    }
    setSoundUploading(true)
    try {
      const form = new FormData()
      form.append('sound', file)
      const label = (soundName || '').trim()
      if (label) form.append('name', label)
      const res = await api.upload('/admin/config/alert-sounds', form)
      const list = Array.isArray(res?.alertSounds) ? res.alertSounds : []
      setAlertSounds(list)
      setActiveAlertSoundId(res?.activeAlertSoundId || null)
      syncGlobalSound(list, res?.activeAlertSoundId || null)
      if (label) setSoundName('')
      showToast('Som enviado', 'success')
    } catch (err) {
      showToast(err.message || 'Falha ao enviar som', 'error')
    } finally {
      setSoundUploading(false)
      if (e?.target) e.target.value = ''
    }
  }

  async function activateSound(id) {
    try {
      const res = await api.post(`/admin/config/alert-sounds/${id || 'none'}/activate`, {})
      const list = Array.isArray(res?.alertSounds) ? res.alertSounds : []
      setAlertSounds(list)
      setActiveAlertSoundId(res?.activeAlertSoundId || null)
      syncGlobalSound(list, res?.activeAlertSoundId || null)
      showToast(id ? 'Som de alerta atualizado' : 'Bip padrão ativado', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao atualizar som de alerta', 'error')
    }
  }

  async function deleteSound(id) {
    if (!id) return
    try {
      if (typeof window !== 'undefined') {
        const ok = window.confirm('Excluir este som de alerta?')
        if (!ok) return
      }
      setSoundDeletingId(id)
      const res = await api.del(`/admin/config/alert-sounds/${id}`)
      const list = Array.isArray(res?.alertSounds) ? res.alertSounds : []
      setAlertSounds(list)
      setActiveAlertSoundId(res?.activeAlertSoundId || null)
      syncGlobalSound(list, res?.activeAlertSoundId || null)
      showToast('Som excluído', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao excluir som', 'error')
    } finally {
      setSoundDeletingId('')
    }
  }

  function previewSound(url) {
    if (!url) {
      showToast('Som indisponível', 'error')
      return
    }
    try {
      previewAudioRef.current?.pause?.()
      previewAudioRef.current = new Audio(url)
      previewAudioRef.current.onended = () => { previewAudioRef.current = null }
      previewAudioRef.current.play().catch(() => {
        showToast('Não foi possível reproduzir o som', 'error')
      })
    } catch {
      showToast('Não foi possível reproduzir o som', 'error')
    }
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

  async function renameGroup(group){
    if (!group?.id) return
    const current = (group.name || '').trim()
    const next = (typeof window !== 'undefined' ? window.prompt('Novo nome do grupo:', current) : current) || ''
    const name = next.trim()
    if (!name || name === current) return
    try {
      await api.patch(`/groups/${group.id}`, { name })
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name } : g))
      if (selectedGroup?.id === group.id) setSelectedGroup(prev => ({ ...prev, name }))
      showToast('Grupo renomeado', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao renomear grupo', 'error')
    }
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
          <button onClick={()=>setTab('metricas')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='metricas'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Metricas</button> 
          <button onClick={()=>setTab('Configuracoes')} className={`px-2 py-2 -mb-px border-b-2 ${tab==='Configuracoes'?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-800'}`}>Configurações</button> 
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
        <section className="mt-4 grid grid-cols-1 lg:grid-cols-[0.9fr_1fr_1.6fr] gap-4 items-start">
          <form onSubmit={createGroup} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-3">
            <div>
              <h4 className="font-medium">Novo Grupo</h4>
              <p className="text-sm text-slate-500">Crie um grupo e depois gerencie os membros ao lado.</p>
            </div>
            <input className="border rounded px-3 py-2" placeholder="Nome do grupo" value={gName} onChange={e=>setGName(e.target.value)} />
            <button className="inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">Criar</button>
          </form>
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium">Lista</h4>
              <div className="text-xs text-slate-500">{groups.length} grupo(s)</div>
            </div>
            {groups.length ? (
              <ul className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
                {groups.map(g => {
                  const isActive = selectedGroup?.id === g.id
                  const disableDelete = isActive && members.length > 0
                  return (
                    <li
                      key={g.id}
                      className={`px-3 py-2 rounded border cursor-pointer transition ${isActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      onClick={()=>openGroup(g)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{g.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                            onClick={(e)=>{ e.stopPropagation(); renameGroup(g) }}
                          >Renomear</button>
                          <button
                            type="button"
                            className={`px-2 py-1 text-xs rounded border border-red-300 text-red-700 ${disableDelete ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'}`}
                            disabled={disableDelete}
                            title={disableDelete ? 'Remova todos os membros antes de excluir' : 'Excluir'}
                            onClick={(e)=>{ e.stopPropagation(); if (!disableDelete) deleteGroup(g.id) }}
                          >Excluir</button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-slate-500">Nenhum grupo encontrado.</div>
            )}
          </div>
          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-3">
            {selectedGroup ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium truncate">Membros - {selectedGroup.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      className={`rounded border px-2 py-1 border-red-300 text-red-700 ${members.length>0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'}`}
                      disabled={members.length>0}
                      title={members.length>0 ? 'Remova todos os membros antes de excluir' : 'Excluir grupo'}
                      onClick={()=>{ if (members.length===0) deleteGroup(selectedGroup.id) }}
                    >Excluir grupo</button>
                    <button type="button" className="rounded border px-2 py-1 hover:bg-slate-50" onClick={selectAllMembers}>Selecionar todos</button>
                    <button type="button" className="rounded border px-2 py-1 hover:bg-slate-50" onClick={clearMemberSelection}>Limpar selecao</button>
                    <button type="button" className="rounded bg-red-600 text-white px-2 py-1 disabled:opacity-60" disabled={!selectedMemberIds.length || removeBulkLoading} onClick={removeSelectedMembers}>{removeBulkLoading?'Removendo...':'Remover selecao'}</button>
                    <button type="button" className="text-slate-600 underline" onClick={refreshMembers}>Atualizar</button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Buscar usuario..." value={memberQuery} onChange={e=>setMemberQuery(e.target.value)} />
                  <select className="border rounded px-2 py-1 text-sm" value={selectedUserToAdd} onChange={e=>setSelectedUserToAdd(e.target.value)}>
                    <option value="">Selecionar usuario</option>
                    {availableUsersFiltered.map(u=> (
                      <option key={u.id} value={u.id}>{u.name} - {u.email}</option>
                    ))}
                  </select>
                  <button type="button" className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60" disabled={!selectedUserToAdd || addingMember} onClick={addMember}>{addingMember?'Adicionando...':'Adicionar'}</button>
                </div>

                {members.length ? (
                  <div className="max-h-[420px] overflow-auto pr-1">
                    <ul className="mt-1 divide-y divide-slate-200">
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
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Sem membros ainda.</div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-500">Selecione um grupo para ver os membros.</div>
            )}
          </div>
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

      {tab==='Configuracoes' && (
        <section className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="bg-white p-4 rounded border border-slate-200 lg:col-span-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Backups do chat</h3>
                <p className="text-sm text-slate-500">Gera cópias do banco de dados e da pasta de uploads. Restaurar um backup substitui dados atuais.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                  onClick={runBackupNow}
                  disabled={backupRunning}
                >
                  {backupRunning ? 'Executando...' : 'Executar backup agora'}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded border hover:bg-slate-50 disabled:opacity-60"
                  onClick={loadBackups}
                  disabled={backupLoading}
                >
                  {backupLoading ? 'Atualizando...' : 'Atualizar lista'}
                </button>
              </div>
            </div>

            <form onSubmit={saveBackupSchedule} className="mt-4 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!backupSettings.autoEnabled}
                  onChange={e=>setBackupSettings(prev=>({ ...prev, autoEnabled: e.target.checked }))}
                />
                Ativar backup automático diário
              </label>
              <div className="grid md:grid-cols-3 gap-3 md:items-end">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Horário</label>
                  <input
                    type="time"
                    className="mt-1 border rounded px-3 py-2 w-full"
                    value={backupSettings.time || '02:00'}
                    onChange={e=>setBackupSettings(prev=>({ ...prev, time: e.target.value }))}
                    disabled={!backupSettings.autoEnabled}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Retenção (dias)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    className="mt-1 border rounded px-3 py-2 w-full"
                    value={backupSettings.retentionDays ?? 7}
                    onChange={e=>setBackupSettings(prev=>({ ...prev, retentionDays: Math.max(0, Number(e.target.value)) }))}
                    disabled={!backupSettings.autoEnabled}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                    disabled={backupSavingSettings}
                  >
                    {backupSavingSettings ? 'Salvando...' : 'Salvar agendamento'}
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div>Último backup manual: {formatDateTime(backupSettings.lastManualRunAt)} {backupSettings.lastManualResult?.ok === false ? `(erro: ${backupSettings.lastManualResult?.error || 'desconhecido'})` : ''}</div>
                <div>Último backup automático: {formatDateTime(backupSettings.lastAutoRunAt)} {backupSettings.lastAutoResult?.ok === false ? `(erro: ${backupSettings.lastAutoResult?.error || 'desconhecido'})` : ''}</div>
                <div>Última restauração: {formatDateTime(backupSettings.lastRestoreAt)} {backupSettings.lastRestoreName ? `(${backupSettings.lastRestoreName})` : ''}</div>
              </div>
            </form>

            <div className="mt-4">
              <h4 className="font-medium">Backups disponíveis</h4>
              {backupLoading ? (
                <div className="mt-2 text-sm text-slate-500">Carregando backups...</div>
              ) : backups.length ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-sm border border-slate-200 rounded">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Nome</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Criado em</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Tamanho</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Origem</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((item) => (
                        <tr key={item.name} className="border-t border-slate-200">
                          <td className="px-3 py-2 font-mono text-xs md:text-sm">{item.name}</td>
                          <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                          <td className="px-3 py-2">{formatBytes(item.size)}</td>
                          <td className="px-3 py-2">
                            {item?.meta?.reason === 'auto' ? 'Automático' : 'Manual'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded border hover:bg-slate-50 disabled:opacity-60"
                                onClick={()=>downloadBackup(item.name)}
                                disabled={backupDownloading === item.name}
                              >
                                {backupDownloading === item.name ? 'Baixando...' : 'Download'}
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                onClick={()=>restoreBackupName(item.name)}
                                disabled={backupRestoring === item.name}
                              >
                                {backupRestoring === item.name ? 'Restaurando...' : 'Restaurar'}
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
                                onClick={()=>deleteBackupName(item.name)}
                                disabled={backupDeleting === item.name}
                              >
                                {backupDeleting === item.name ? 'Excluindo...' : 'Excluir'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-500">Nenhum backup encontrado ainda.</div>
              )}
            </div>
          </div>

          {/* Global (para todos) */}
          <div className="bg-white p-4 rounded border border-slate-200 lg:col-span-2 space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">Marca e aparencia global</h3>
              <p className="text-sm text-slate-500">Configuracoes aplicadas para todos os usuarios.</p>
            </div>
            <div className="mt-3 grid md:grid-cols-3 gap-4">

              {/* Ícone global */}
              <div>
                <h4 className="font-medium">Ícone do chat</h4>
                <div className="mt-2 flex items-center gap-3">
                  {globalIconUrl ? (
                    <img src={globalIconUrl} alt="global" className="w-12 h-12 rounded-full object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full border bg-slate-100" />
                  )}
                  <div className="flex items-center gap-2">
                    <input id="cfg-file-global" className="hidden" type="file" accept="image/*" onChange={e=>uploadGlobalIcon(e.target.files?.[0])} />
                    <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>document.getElementById('cfg-file-global')?.click()}>Enviar</button>
                    {globalIconUrl && <button type="button" className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>{ try{ localStorage.setItem('chat_icon', globalIconUrl); window.dispatchEvent(new Event('chat:iconUpdated')); showToast('Aplicado icone global neste navegador', 'success') } catch{} }}>Aplicar local</button>}
                  </div>
                </div>
              </div>
              {/* Logo da tela de login */}<div className="p-3 rounded border border-slate-200 bg-slate-50/60">
                <h4 className="font-medium">Logo da tela de login</h4>
                <div className="mt-2 flex items-center gap-3">
                  {loginLogoUrl ? (
                    <img src={loginLogoUrl} alt="logo de login" className="w-16 h-16 rounded-xl object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border bg-slate-100 grid place-items-center text-xs text-slate-400">Sem logo</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input id="login-logo-file" className="hidden" type="file" accept="image/*" onChange={e=>uploadLoginLogo(e.target.files?.[0])} />
                    <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-60" onClick={()=>document.getElementById('login-logo-file')?.click()} disabled={loginLogoUploading}>{loginLogoUploading?'Enviando...':'Enviar'}</button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      onClick={deleteLoginLogo}
                      disabled={loginLogoDeleting}
                    >
                      {loginLogoDeleting ? 'Excluindo...' : 'Remover (deixar sem logo)'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-60"
                      onClick={saveLoginLogo}
                      disabled={loginLogoSaving}
                    >
                      {loginLogoSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Exibido na página de login. Reenvie para substituir.</div>
              </div>
              {/* Wallpaper global */}<div className="p-3 rounded border border-slate-200 bg-slate-50/60">
                <h4 className="font-medium">Papel de parede (conversas)</h4>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-28 h-16 rounded border bg-slate-100 overflow-hidden">
                    <div className="w-full h-full chat-bg" style={{ ['--chat-wallpaper']: globalWallpaperUrl ? `url('${globalWallpaperUrl}')` : undefined }}></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input id="cfg-file-wallpaper" className="hidden" type="file" accept="image/*" onChange={e=>uploadGlobalWallpaper(e.target.files?.[0])} />
                    <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50" onClick={()=>document.getElementById('cfg-file-wallpaper')?.click()}>Enviar</button>
                    <button type="button" className="px-3 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50" onClick={saveGlobalWallpaper} disabled={!globalWallpaperUrl}>Salvar</button>
                    <button type="button" className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>{ try{ if(!globalWallpaperUrl){ showToast('Nenhum wallpaper para aplicar', 'error'); return } localStorage.setItem('chat_wallpaper', globalWallpaperUrl); document.documentElement.style.setProperty('--chat-wallpaper', `url('${globalWallpaperUrl}')`); window.dispatchEvent(new Event('chat:wallpaperUpdated')); showToast('Aplicado localmente', 'success') } catch{} }} disabled={!globalWallpaperUrl}>Aplicar local</button>
                    <button type="button" className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50" onClick={deleteGlobalWallpaper} disabled={!globalWallpaperUrl}>Excluir</button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Afeta todos os usuários. A aplicação local funciona apenas neste navegador.</div>
              </div>
              {/* Sons de alerta */}
              <div className="md:col-span-3 p-4 rounded border border-slate-200 bg-slate-50/60">
                <h4 className="font-medium">Sons de alerta</h4>
                <div className="mt-1 text-xs text-slate-500">Faça upload de arquivos de áudio (mp3, wav, ogg) para usar como alerta padrão do chat.</div>
                <div className="mt-3 flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Nome (opcional)</label>
                    <input className="mt-1 border rounded px-3 py-2 w-full" placeholder="Ex.: Alerta ping" value={soundName} onChange={e=>setSoundName(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={soundInputRef} type="file" accept="audio/*" className="hidden" onChange={onSoundSelected} />
                    <button type="button" className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-60" onClick={triggerSoundUpload} disabled={soundUploading}>{soundUploading?'Enviando...':'Enviar som'}</button>
                    {soundUploading && <span className="text-xs text-slate-500">Aguarde...</span>}
                  </div>
                </div>
                {alertSounds.length ? (
                  <ul className="mt-3 divide-y divide-slate-200">
                    {alertSounds.map(sound => (
                      <li key={sound.id} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{sound.name || 'Som'}</div>
                          <div className="text-xs text-slate-500 truncate">{sound.url}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" className="px-2 py-1 text-sm rounded border hover:bg-slate-50" onClick={()=>previewSound(sound.url)}>Ouvir</button>
                          {activeAlertSoundId === sound.id ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">Ativo</span>
                          ) : (
                            <button type="button" className="px-2 py-1 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={()=>activateSound(sound.id)}>Definir</button>
                          )}
                          <button type="button" className="px-2 py-1 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60" onClick={()=>deleteSound(sound.id)} disabled={soundDeletingId===sound.id}>{soundDeletingId===sound.id?'Excluindo...':'Excluir'}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">Nenhum som cadastrado ainda.</div>
                )}
              <div className="mt-3">
                <button type="button" className="text-xs text-slate-600 underline disabled:opacity-60" onClick={()=>activateSound(null)} disabled={!activeAlertSoundId}>Usar bip padrão</button>
              </div>
            </div>
            <div className="md:col-span-3 p-4 rounded border border-slate-200 bg-slate-50/60 space-y-3">
              <h4 className="font-medium">E-mail</h4>
              <p className="text-xs text-slate-500">Configurações SMTP utilizadas para enviar a nova senha de login ao recuperar a conta.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Servidor SMTP (host)"
                  value={smtpHost}
                  onChange={e=>setSmtpHost(e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2"
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="Porta"
                  value={smtpPort}
                  onChange={e=>setSmtpPort(e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Remetente (from)"
                  value={smtpFrom}
                  onChange={e=>setSmtpFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Usuário SMTP (opcional)"
                  value={smtpUser}
                  onChange={e=>setSmtpUser(e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2"
                  type="password"
                  placeholder="Senha SMTP (deixe em branco para manter)"
                  value={smtpPassword}
                  onChange={e=>setSmtpPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" className="rounded border-slate-300" checked={smtpSecure} onChange={e=>setSmtpSecure(e.target.checked)} />
                  Usar TLS/SSL (STARTTLS/SMTPS)
                </label>
                {smtpPasswordSet && <span className="text-xs text-slate-500">Senha já configurada</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                  onClick={saveEmailConfig}
                  disabled={emailSaving}
                >
                  {emailSaving ? 'Salvando...' : 'Salvar e-mail'}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={testEmailConfig}
                  disabled={smtpTesting}
                >
                  {smtpTesting ? 'Verificando...' : 'Verificar SMTP'}
                </button>
                <span className="text-xs text-slate-500">As alterações afetarão o envio da recuperação de senha.</span>
              </div>
            </div>
            </div>
          </div>

          {/* Segurança */}
          <form onSubmit={changeAdminPassword} className="bg-white p-4 rounded border border-slate-200 flex flex-col gap-2 lg:col-span-3">
            <h3 className="text-lg font-semibold">Conta do administrador</h3>
            <div className="grid md:grid-cols-3 gap-2 mt-2">
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

      {tab==='metricas' && (
        <section className="mt-4 space-y-4">
          <div className="bg-white p-4 rounded border border-slate-200 space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Metricas do chat</h3>
                <p className="text-sm text-slate-500">Monitoramento de carga e atividade das conversas.</p>
              </div>
              <button
                type="button"
                className="px-3 py-1 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                onClick={loadMetrics}
                disabled={metricsLoading}
              >
                {metricsLoading ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>
            {metricsError && <div className="text-sm text-red-600">{metricsError}</div>}
            {!metrics && metricsLoading && <div className="text-sm text-slate-500">Carregando metricas...</div>}
            {metrics && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Usuarios cadastrados</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.totalUsers)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Grupos registrados</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.totalGroups)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Mensagens totais</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.totalMessages)}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded border border-slate-200 bg-white">
                    <div className="text-xs text-slate-500">Mensagens ultimas 24h</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.messagesLast24Hours)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-white">
                    <div className="text-xs text-slate-500">Mensagens ultima hora</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.messagesLastHour)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-white">
                    <div className="text-xs text-slate-500">Media / min (ultima hora)</div>
                    <div className="text-2xl font-semibold">{formatDecimal(metrics.avgMessagesPerMinuteLastHour)}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Usuarios online agora</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.onlineUsers)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Sessoes ativas</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.onlineSessions)}</div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-500">Grupos ativos (ultima hora)</div>
                    <div className="text-2xl font-semibold">{formatNumber(metrics.groupsActiveLastHour)}</div>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-700">Ultimos 10 minutos</h4>
                      <span className="text-xs text-slate-500">Minutos</span>
                    </div>
                    <div className="space-y-2">
                      {metricsTimeline.list.map((bucket) => (
                        <div key={bucket.timestamp} className="flex items-center gap-3 text-xs">
                          <div className="w-16 text-right text-slate-500">{bucket.label}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${(bucket.count / metricsTimeline.max) * 100}%` }} />
                          </div>
                          <div className="w-10 text-right font-semibold text-slate-700">{bucket.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded border border-slate-200 bg-white space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Grupos mais ativos (24h)</h4>
                    {metrics.busiestGroups?.length ? (
                      <ul className="space-y-2 text-sm text-slate-600">
                        {metrics.busiestGroups.map((group) => (
                          <li key={group.groupId} className="flex items-center justify-between">
                            <span className="truncate">{group.name}</span>
                            <span className="text-xs text-slate-500">{formatNumber(group.messages)} msgs</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-500">Nenhum grupo ativo neste periodo.</div>
                    )}
                    <div className="text-xs text-slate-500">
                      Grupos ativos 24h: {formatNumber(metrics.groupsActiveLast24Hours)}
                    </div>
                  </div>
                </div>
                {metrics.lastMessage && (
                  <div className="text-xs text-slate-500">
                    Ultima mensagem em <span className="font-medium text-slate-700">{metrics.lastMessage.groupName || '-'}</span> por <span className="font-medium text-slate-700">{metrics.lastMessage.authorName || '-'}</span> em {formatDateTime(metrics.lastMessage.createdAt)}
                  </div>
                )}
              </div>
            )}
          </div>
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



