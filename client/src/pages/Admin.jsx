import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { getUser, getToken } from '../state/auth.js'
import { api, API_BASE, absUrl } from '../services/api.js'

// ---------- Componentes visuais (mesma paleta do chat: classes ui-*) ----------
const inputCls =
  'h-10 w-full rounded-xl border border-ui-border bg-ui-input px-3 text-sm text-ui-text placeholder:text-ui-muted focus:border-ui-primary/60 focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
const selectCls = `${inputCls} pr-8`

function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-ui-border bg-ui-list p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-ui-text">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ui-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

function Btn({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-10 px-4 text-sm' }
  const variants = {
    primary: 'bg-ui-primary text-white shadow-sm shadow-blue-600/20 hover:bg-ui-primary-hover',
    secondary: 'border border-ui-border bg-ui-btn text-ui-text hover:bg-ui-hover',
    danger: 'border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400',
    ghost: 'text-ui-muted hover:bg-ui-hover hover:text-ui-text',
  }
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-500/10 text-ui-muted',
    blue: 'bg-ui-primary/10 text-ui-primary dark:text-blue-300',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-ui-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ui-muted">{hint}</span>}
    </label>
  )
}

function Checkbox({ checked, onChange, label, disabled, title }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-ui-text ${disabled ? 'opacity-50' : 'cursor-pointer'}`} title={title}>
      <input type="checkbox" className="h-4 w-4 rounded border-ui-border accent-[var(--ui-primary)]" checked={checked} onChange={onChange} disabled={disabled} />
      {label}
    </label>
  )
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-ui-border px-4 py-6 text-center text-sm text-ui-muted">{children}</div>
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#4f9cf7']
function UserAvatar({ name, url, size = 36 }) {
  const [broken, setBroken] = useState(false)
  let hash = 0
  const text = String(name || '')
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  const style = { width: size, height: size }
  if (url && !broken) {
    return <img src={absUrl(url)} alt={name || 'avatar'} style={style} className="shrink-0 rounded-full object-cover" onError={() => setBroken(true)} />
  }
  return (
    <span
      style={{ ...style, background: AVATAR_COLORS[hash % AVATAR_COLORS.length], fontSize: Math.round(size * 0.36) }}
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
    >
      {(text.trim().split(/\s+/)[0] || 'U').slice(0, 2).toUpperCase()}
    </span>
  )
}

function Stat({ label, value, hint, accent }) {
  return (
    <div className="rounded-2xl border border-ui-border bg-ui-list p-4">
      <div className="text-xs font-medium text-ui-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tight ${accent ? 'text-ui-primary dark:text-blue-300' : 'text-ui-text'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ui-muted">{hint}</div>}
    </div>
  )
}

const TABS = [
  { key: 'usuarios', label: 'Usuários' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'telefonia', label: 'Telefonia' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'configuracoes', label: 'Configurações' },
]

export default function Admin() {
  const me = getUser()
  const [tab, setTab] = useState('usuarios')

  // Users
  const [users, setUsers] = useState([])
  const [uName, setUName] = useState('')
  const [uEmail, setUEmail] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uPhone, setUPhone] = useState('')
  const [uAddress, setUAddress] = useState('')
  const [uIsAdmin, setUIsAdmin] = useState(false)
  const [uCreating, setUCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // user object
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [resetPwd, setResetPwd] = useState('')
  const [selfCurrentPwd, setSelfCurrentPwd] = useState('')

  // Helpers: telefone BR simples (DDD + número)
  const digitsOnly = (s) => (s || '').replace(/\D/g, '')
  const formatBrPhone = (s) => {
    const d = digitsOnly(s).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    return d
  }

  // Groups
  const [groups, setGroups] = useState([])
  const [gName, setGName] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [removeBulkLoading, setRemoveBulkLoading] = useState(false)
  // Add-to-group (por usuário na lista)
  const [addToGroupUserId, setAddToGroupUserId] = useState(null)
  const [addToGroupGroupId, setAddToGroupGroupId] = useState('')
  const [addToGroupLoading, setAddToGroupLoading] = useState(false)
  // Toast simples
  const [toast, setToast] = useState(null) // { type: 'success'|'error'|'info', message: string }
  const toastTimer = useRef(null)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  function showToast(message, type = 'info', ms = 3500) {
    setToast({ message, type })
    try {
      clearTimeout(toastTimer.current)
      if (ms) toastTimer.current = setTimeout(() => setToast(null), ms)
    } catch {}
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

  // Configurações: aparência
  const [globalIconUrl, setGlobalIconUrl] = useState('')
  const [iconUploading, setIconUploading] = useState(false)
  const [globalWallpaperUrl, setGlobalWallpaperUrl] = useState('')
  const [wallpaperUploading, setWallpaperUploading] = useState(false)
  const [loginLogoUrl, setLoginLogoUrl] = useState('')
  const [loginLogoUploading, setLoginLogoUploading] = useState(false)
  const iconInputRef = useRef(null)
  const wallpaperInputRef = useRef(null)
  const loginLogoInputRef = useRef(null)
  // Sons
  const [alertSounds, setAlertSounds] = useState([])
  const [activeAlertSoundId, setActiveAlertSoundId] = useState(null)
  const [soundName, setSoundName] = useState('')
  const [soundUploading, setSoundUploading] = useState(false)
  const [soundDeletingId, setSoundDeletingId] = useState('')
  const soundInputRef = useRef(null)
  const previewAudioRef = useRef(null)
  // E-mail
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpFrom, setSmtpFrom] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  // Backups
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
  // Senha do admin
  const [admCurrentPwd, setAdmCurrentPwd] = useState('')
  const [admNewPwd, setAdmNewPwd] = useState('')
  const [admNewPwd2, setAdmNewPwd2] = useState('')
  const [admPwdSaving, setAdmPwdSaving] = useState(false)

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

  // Aplica ícone/papel de parede globais neste navegador (o App lê estes valores)
  function applyIconLocally(url) {
    try {
      if (url) localStorage.setItem('chat_icon', url)
      else localStorage.removeItem('chat_icon')
      window.dispatchEvent(new Event('chat:iconUpdated'))
    } catch {}
  }
  function applyWallpaperLocally(url) {
    try {
      // Remove o antigo "aplicar local", que impedia ver mudanças do papel de parede global
      localStorage.removeItem('chat_wallpaper')
      if (url) document.documentElement.style.setProperty('--chat-wallpaper', `url('${url}')`)
      else document.documentElement.style.removeProperty('--chat-wallpaper')
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
    loadAdminConfig({ silent: true })
  }, [])

  const loadMetrics = useCallback(async () => {
    setMetricsError('')
    setMetricsLoading(true)
    try {
      const data = await api.get('/admin/metrics')
      setMetrics(data)
    } catch (err) {
      setMetricsError(err.message || 'Falha ao carregar métricas')
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  async function uploadGlobalIcon(file) {
    if (!file) return
    setIconUploading(true)
    try {
      const form = new FormData()
      form.append('icon', file)
      const data = await api.upload('/admin/config/icon', form)
      setGlobalIconUrl(data?.chatIconUrl || '')
      applyIconLocally(data?.chatIconUrl || '')
      showToast('Ícone do chat atualizado para todos', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao enviar ícone', 'error')
    } finally {
      setIconUploading(false)
    }
  }
  async function removeGlobalIcon() {
    if (!window.confirm('Remover o ícone do chat? Será usado o ícone padrão.')) return
    try {
      await api.patch('/admin/config', { chatIconUrl: null })
      setGlobalIconUrl('')
      applyIconLocally('')
      showToast('Ícone removido', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao remover ícone', 'error')
    }
  }

  async function uploadGlobalWallpaper(file) {
    if (!file) return
    setWallpaperUploading(true)
    try {
      const form = new FormData()
      form.append('wallpaper', file)
      const data = await api.upload('/admin/config/wallpaper', form)
      setGlobalWallpaperUrl(data?.chatWallpaperUrl || '')
      applyWallpaperLocally(data?.chatWallpaperUrl || '')
      showToast('Papel de parede atualizado para todos', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao enviar papel de parede', 'error')
    } finally {
      setWallpaperUploading(false)
    }
  }
  async function deleteGlobalWallpaper() {
    if (!window.confirm('Remover o papel de parede? As conversas voltam ao fundo liso.')) return
    try {
      await api.delete('/admin/config/wallpaper')
      setGlobalWallpaperUrl('')
      applyWallpaperLocally('')
      showToast('Papel de parede removido', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao remover papel de parede', 'error')
    }
  }

  async function uploadLoginLogo(file) {
    if (!file) return
    setLoginLogoUploading(true)
    try {
      const form = new FormData()
      form.append('loginLogo', file)
      const data = await api.upload('/admin/config/login-logo', form)
      setLoginLogoUrl(data?.loginLogoUrl || '')
      showToast('Logo da tela de login atualizada', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao enviar logo', 'error')
    } finally {
      setLoginLogoUploading(false)
    }
  }
  async function deleteLoginLogo() {
    if (!window.confirm('Remover a logo da tela de login?')) return
    try {
      await api.delete('/admin/config/login-logo')
      setLoginLogoUrl('')
      showToast('Logo removida', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao remover logo', 'error')
    }
  }

  async function saveEmailConfig(e) {
    e?.preventDefault?.()
    if (emailSaving) return
    setEmailSaving(true)
    try {
      const payload = { host: smtpHost, port: smtpPort, secure: smtpSecure, user: smtpUser, from: smtpFrom }
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

  async function testEmailConfig() {
    if (smtpTesting) return
    setSmtpTesting(true)
    try {
      await api.post('/admin/config/email/test', {})
      showToast('Conexão SMTP verificada com sucesso', 'success')
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
      setBackupSettings({ ...defaultBackupSettings, ...(data?.settings || {}) })
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
    if (!window.confirm(`Restaurar o backup "${name}"?\n\nTodas as mensagens e arquivos atuais serão substituídos pelos do backup.`)) return
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
    if (!window.confirm(`Excluir o backup "${name}"?`)) return
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
        let msg = 'Falha ao preparar download'
        try { msg = (await res.json())?.error || msg } catch {}
        throw new Error(msg)
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
      setBackupSettings({ ...defaultBackupSettings, ...(data?.settings || payload) })
      showToast('Agendamento de backup salvo', 'success')
    } catch (err) {
      showToast(err.message || 'Falha ao salvar agendamento', 'error')
    } finally {
      setBackupSavingSettings(false)
    }
  }

  useEffect(() => {
    if (tab === 'configuracoes') loadBackups()
  }, [tab, loadBackups])

  useEffect(() => {
    if (tab === 'metricas') loadMetrics()
  }, [tab, loadMetrics])

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
    if (!window.confirm('Excluir este som de alerta?')) return
    setSoundDeletingId(id)
    try {
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
      previewAudioRef.current.play().catch(() => showToast('Não foi possível reproduzir o som', 'error'))
    } catch {
      showToast('Não foi possível reproduzir o som', 'error')
    }
  }

  async function changeAdminPassword(e) {
    e?.preventDefault?.()
    const current = (admCurrentPwd || '').trim()
    const password = (admNewPwd || '').trim()
    const confirm = (admNewPwd2 || '').trim()
    if (!current) return showToast('Informe a senha atual', 'error')
    if (password.length < 6) return showToast('A nova senha deve ter pelo menos 6 caracteres', 'error')
    if (password !== confirm) return showToast('A confirmação não confere', 'error')
    setAdmPwdSaving(true)
    try {
      await api.post('/users/me/password', { current, password })
      setAdmCurrentPwd(''); setAdmNewPwd(''); setAdmNewPwd2('')
      showToast('Sua senha foi alterada. Outros dispositivos precisarão entrar de novo.', 'success', 5000)
    } catch (e) {
      showToast(e.message || 'Falha ao alterar senha', 'error')
    } finally {
      setAdmPwdSaving(false)
    }
  }

  // Load lists
  async function refreshUsers() {
    try { const us = await api.get('/users'); setUsers(Array.isArray(us) ? us : []) } catch (e) { showToast(e.message || 'Falha ao carregar usuários', 'error') }
  }
  async function refreshGroups() {
    try { const gs = await api.get('/groups/all?includeDMs=false'); setGroups(Array.isArray(gs) ? gs : []) } catch (e) { showToast(e.message || 'Falha ao carregar grupos', 'error') }
  }
  useEffect(() => { refreshUsers(); refreshGroups() }, [])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => `${u.name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(q))
  }, [users, query])
  const availableUsers = useMemo(() => users.filter((u) => !members.some((m) => m.userId === u.id)), [users, members])
  const availableUsersFiltered = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return availableUsers
    return availableUsers.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q))
  }, [availableUsers, memberQuery])

  async function createUser(e) {
    e?.preventDefault?.()
    const phoneFmt = formatBrPhone(uPhone)
    const phoneDigits = digitsOnly(phoneFmt)
    const body = {
      name: uName.trim(),
      email: uEmail.trim(),
      password: uPassword,
      isAdmin: !!uIsAdmin,
      phone: phoneDigits ? phoneFmt : null,
      address: (uAddress || '').trim() || null,
    }
    if (body.name.length < 2) return showToast('Informe um nome válido.', 'error')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return showToast('E-mail inválido.', 'error')
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) return showToast('Telefone inválido (use DDD + número).', 'error')
    if (!body.password || body.password.length < 6) return showToast('A senha deve ter pelo menos 6 caracteres.', 'error')
    setUCreating(true)
    try {
      await api.post('/users', body)
      await refreshUsers()
      setUName(''); setUEmail(''); setUPassword(''); setUPhone(''); setUAddress(''); setUIsAdmin(false)
      showToast(`Usuário ${body.name} criado`, 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao criar usuário', 'error')
    } finally {
      setUCreating(false)
    }
  }

  function openEdit(u) { setEditing({ ...u }); setResetPwd(''); setSelfCurrentPwd(''); setEditError('') }
  function closeEdit() { if (editSaving) return; setEditing(null); setResetPwd(''); setSelfCurrentPwd(''); setEditError('') }
  const editingSelf = !!(me?.id && editing?.id === me.id)
  async function saveEdit(e) {
    e?.preventDefault?.()
    if (!editing) return
    setEditSaving(true)
    setEditError('')
    try {
      const phoneFmt = formatBrPhone(editing.phone || '')
      const phoneDigits = digitsOnly(phoneFmt)
      if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) throw new Error('Telefone inválido (use DDD + número).')
      const pwd = (resetPwd || '').trim()
      if (pwd && pwd.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.')
      if (pwd && editingSelf && !selfCurrentPwd.trim()) throw new Error('Informe sua senha atual para alterar a sua senha.')
      const body = {
        name: (editing.name || '').trim(),
        email: (editing.email || '').trim(),
        phone: phoneDigits ? phoneFmt : null,
        address: (editing.address || '').trim() || null,
        ...(editingSelf ? {} : { isAdmin: !!editing.isAdmin, isBlocked: !!editing.isBlocked }),
      }
      await api.patch(`/users/${editing.id}`, body)
      if (pwd) {
        if (editingSelf) await api.post('/users/me/password', { current: selfCurrentPwd.trim(), password: pwd })
        else await api.post(`/users/${editing.id}/password`, { password: pwd })
      }
      await refreshUsers()
      setEditSaving(false)
      setEditing(null)
      showToast('Usuário atualizado', 'success')
    } catch (e) {
      setEditError(e.message || 'Falha ao salvar usuário')
      setEditSaving(false)
    }
  }
  async function deleteUser(u) {
    if (!window.confirm(`Excluir ${u.name}?\n\nAs mensagens e conversas diretas dessa pessoa também serão apagadas.`)) return
    try {
      await api.del(`/users/${u.id}`)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      showToast('Usuário excluído', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao excluir', 'error')
    }
  }

  function openAddToGroup(u) { setAddToGroupUserId(u.id); setAddToGroupGroupId('') }
  function cancelAddToGroup() { setAddToGroupUserId(null); setAddToGroupGroupId('') }
  async function confirmAddToGroup() {
    if (!addToGroupUserId || !addToGroupGroupId) return
    setAddToGroupLoading(true)
    try {
      await api.post(`/groups/${addToGroupGroupId}/members`, { userId: addToGroupUserId })
      if (selectedGroup?.id === addToGroupGroupId) await refreshMembers()
      await refreshGroups()
      cancelAddToGroup()
      showToast('Usuário adicionado ao grupo', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao adicionar ao grupo', 'error')
    } finally {
      setAddToGroupLoading(false)
    }
  }

  async function createGroup(e) {
    e?.preventDefault?.()
    const name = (gName || '').trim()
    if (name.length < 2) return showToast('Informe um nome de grupo com 2 ou mais caracteres.', 'error')
    try {
      const created = await api.post('/groups', { name })
      await refreshGroups()
      setGName('')
      showToast(`Grupo ${name} criado`, 'success')
      if (created?.id) openGroup({ ...created, memberCount: 0, messageCount: 0 })
    } catch (e) {
      showToast(e.message || 'Falha ao criar grupo', 'error')
    }
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
    try { const list = await api.get('/phone'); setSipList(Array.isArray(list) ? list : []) }
    catch (e) { setSipError(e.message || 'Falha ao carregar contas SIP') }
    finally { setSipLoading(false) }
  }
  useEffect(() => { loadSip() }, [])

  async function saveSip(e) {
    e?.preventDefault?.()
    const uid = (sipUserId || '').trim()
    const domain = (sipDomain || '').trim()
    const extension = (sipExtension || '').trim()
    const password = (sipPassword || '').trim()
    if (!uid || !domain || !extension) return showToast('Informe usuário, domínio e ramal.', 'error')
    setSipSaving(true)
    try {
      await api.patch(`/phone/${uid}`, { domain, extension, ...(password ? { password } : {}) })
      await loadSip(); setSipUserId(''); setSipDomain(''); setSipExtension(''); setSipPassword('')
      showToast('Conta SIP salva', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao salvar conta SIP', 'error')
    } finally {
      setSipSaving(false)
    }
  }
  function openSipEdit(item) {
    setSipEditingId(item.user.id)
    setSipEdit({ domain: item.domain || '', extension: item.extension || '', password: '' })
  }
  function cancelSipEdit() { setSipEditingId(null); setSipEdit({ domain: '', extension: '', password: '' }) }
  async function saveSipEdit() {
    if (!sipEditingId) return
    const body = { domain: (sipEdit.domain || '').trim(), extension: (sipEdit.extension || '').trim() }
    if (!body.domain || !body.extension) return showToast('Domínio e ramal são obrigatórios.', 'error')
    if ((sipEdit.password || '').trim()) body.password = (sipEdit.password || '').trim()
    setSipSaving(true)
    try {
      await api.patch(`/phone/${sipEditingId}`, body)
      await loadSip(); cancelSipEdit(); showToast('Conta SIP atualizada', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao atualizar conta SIP', 'error')
    } finally {
      setSipSaving(false)
    }
  }
  async function disconnectSip(userId) {
    try { await api.post(`/phone/${userId}/disconnect`, {}); await loadSip(); showToast('Ramal marcado como desconectado', 'success') } catch (e) { showToast(e.message || 'Falha ao desconectar', 'error') }
  }
  async function deleteSip(userId) {
    if (!window.confirm('Excluir o ramal (conta SIP) deste usuário?')) return
    try {
      await api.delete(`/phone/${userId}`)
      await loadSip()
      if (sipEditingId === userId) cancelSipEdit()
      showToast('Ramal excluído', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao excluir ramal', 'error')
    }
  }
  const sipUserIds = useMemo(() => new Set(sipList.map((a) => a.user?.id)), [sipList])
  const filteredSip = useMemo(() => {
    const q = sipQuery.trim().toLowerCase()
    if (!q) return sipList
    return sipList.filter((a) => `${a.user?.name || ''} ${a.user?.email || ''} ${a.extension || ''} ${a.domain || ''}`.toLowerCase().includes(q))
  }, [sipList, sipQuery])

  async function openGroup(g) {
    setSelectedGroup(g)
    setMemberQuery('')
    setSelectedUserToAdd('')
    setSelectedMemberIds([])
    setMembersLoading(true)
    try {
      const ms = await api.get(`/groups/${g.id}/members`)
      setMembers(Array.isArray(ms) ? ms : [])
    } catch (e) {
      setMembers([])
      showToast(e.message || 'Falha ao carregar membros', 'error')
    } finally {
      setMembersLoading(false)
    }
  }

  // Excluir apaga também mensagens e membros (o servidor cuida disso); pede confirmação clara
  async function deleteGroup(group) {
    if (!group?.id) return
    const memberCount = selectedGroup?.id === group.id ? members.length : group.memberCount || 0
    const details = []
    if (memberCount) details.push(`${memberCount} membro(s)`)
    if (group.messageCount) details.push(`${group.messageCount} mensagem(ns)`)
    const extra = details.length ? `\n\nO grupo tem ${details.join(' e ')}. Tudo será apagado.` : ''
    if (!window.confirm(`Excluir o grupo "${group.name}"?${extra}\n\nEsta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/groups/${group.id}`)
      setGroups((prev) => prev.filter((g) => g.id !== group.id))
      if (selectedGroup?.id === group.id) { setSelectedGroup(null); setMembers([]) }
      showToast('Grupo excluído', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao excluir grupo', 'error')
    }
  }

  async function renameGroup(group) {
    if (!group?.id) return
    const current = (group.name || '').trim()
    const name = (window.prompt('Novo nome do grupo:', current) || '').trim()
    if (!name || name === current) return
    if (name.length < 2) return showToast('O nome precisa ter 2 ou mais caracteres.', 'error')
    try {
      await api.patch(`/groups/${group.id}`, { name })
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name } : g)))
      if (selectedGroup?.id === group.id) setSelectedGroup((prev) => ({ ...prev, name }))
      showToast('Grupo renomeado', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao renomear grupo', 'error')
    }
  }

  async function refreshMembers() {
    if (!selectedGroup) return
    try {
      const ms = await api.get(`/groups/${selectedGroup.id}/members`)
      const list = Array.isArray(ms) ? ms : []
      setMembers(list)
      setGroups((prev) => prev.map((g) => (g.id === selectedGroup.id ? { ...g, memberCount: list.length } : g)))
    } catch {}
  }

  async function addMember() {
    if (!selectedGroup || !selectedUserToAdd) return
    setAddingMember(true)
    try {
      await api.post(`/groups/${selectedGroup.id}/members`, { userId: selectedUserToAdd })
      setSelectedUserToAdd('')
      setMemberQuery('')
      await refreshMembers()
      showToast('Membro adicionado', 'success')
    } catch (e) {
      showToast(e.message || 'Falha ao adicionar membro', 'error')
    } finally {
      setAddingMember(false)
    }
  }

  async function removeMember(m) {
    if (!selectedGroup) return
    if (!window.confirm(`Remover ${m.user?.name || 'este membro'} de ${selectedGroup.name}?`)) return
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${m.userId}`)
      setSelectedMemberIds((prev) => prev.filter((id) => id !== m.userId))
      await refreshMembers()
    } catch (e) {
      showToast(e.message || 'Falha ao remover', 'error')
    }
  }

  function toggleSelectMember(userId) {
    setSelectedMemberIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }
  async function removeSelectedMembers() {
    if (!selectedGroup || !selectedMemberIds.length) return
    if (!window.confirm(`Remover ${selectedMemberIds.length} membro(s) de ${selectedGroup.name}?`)) return
    setRemoveBulkLoading(true)
    try {
      const results = await Promise.allSettled(selectedMemberIds.map((id) => api.delete(`/groups/${selectedGroup.id}/members/${id}`)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      await refreshMembers()
      setSelectedMemberIds([])
      showToast(fail ? `Removidos: ${ok}. Falhas: ${fail}.` : `${ok} membro(s) removido(s)`, fail ? 'error' : 'success')
    } finally {
      setRemoveBulkLoading(false)
    }
  }

  const tabCounts = { usuarios: users.length, grupos: groups.length, telefonia: sipList.length }
  const allMembersSelected = members.length > 0 && selectedMemberIds.length === members.length

  return (
    <div className="h-full overflow-auto bg-ui-chat">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              : toast.type === 'error'
              ? 'border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'border-ui-border bg-ui-list text-ui-text'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ui-text">Administração</h1>
            <p className="mt-1 text-sm text-ui-muted">Gerencie usuários, grupos, ramais e as configurações do chat.</p>
          </div>
        </header>

        <nav className="mt-5 flex flex-wrap gap-1 rounded-2xl border border-ui-border bg-ui-list p-1" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.key
            const count = tabCounts[t.key]
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-ui-primary text-white shadow-sm shadow-blue-600/30' : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'
                }`}
              >
                {t.label}
                {typeof count === 'number' && (
                  <span className={`rounded-md px-1.5 text-[11px] font-semibold leading-5 ${active ? 'bg-white/20 text-white' : 'bg-ui-hover text-ui-muted'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ---------------- Usuários ---------------- */}
        {tab === 'usuarios' && (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[360px_1fr]">
            <Card title="Novo usuário" subtitle="A pessoa entra com o e-mail e a senha definidos aqui.">
              <form onSubmit={createUser} className="flex flex-col gap-3">
                <Field label="Nome"><input className={inputCls} value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Nome completo" /></Field>
                <Field label="E-mail"><input className={inputCls} type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder="pessoa@empresa.com" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone (opcional)"><input className={inputCls} value={uPhone} onChange={(e) => setUPhone(formatBrPhone(e.target.value))} placeholder="(00) 00000-0000" /></Field>
                  <Field label="Senha"><input className={inputCls} type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)} placeholder="Mín. 6 caracteres" autoComplete="new-password" /></Field>
                </div>
                <Field label="Endereço (opcional)"><input className={inputCls} value={uAddress} onChange={(e) => setUAddress(e.target.value)} placeholder="Rua, número, cidade" /></Field>
                <Checkbox checked={uIsAdmin} onChange={(e) => setUIsAdmin(e.target.checked)} label="Administrador (acesso a esta área)" />
                <Btn type="submit" variant="primary" disabled={uCreating} className="mt-1 w-full">{uCreating ? 'Criando...' : 'Criar usuário'}</Btn>
              </form>
            </Card>

            <Card
              title="Usuários"
              subtitle={`${users.length} cadastrado(s)`}
              actions={
                <>
                  <input className={`${inputCls} h-9 w-56`} placeholder="Buscar por nome, e-mail..." value={query} onChange={(e) => setQuery(e.target.value)} />
                  <Btn size="sm" onClick={refreshUsers} className="h-9">Atualizar</Btn>
                </>
              }
            >
              {filteredUsers.length ? (
                <ul className="divide-y divide-ui-border">
                  {filteredUsers.map((u) => {
                    const isSelf = me?.id === u.id
                    return (
                      <li key={u.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <UserAvatar name={u.name} url={u.avatarUrl} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-ui-text">{u.name}</span>
                              {isSelf && <Badge tone="blue">Você</Badge>}
                              {u.isAdmin && <Badge tone="amber">Admin</Badge>}
                              {u.isBlocked && <Badge tone="red">Bloqueado</Badge>}
                              {sipUserIds.has(u.id) && <Badge>Ramal</Badge>}
                            </div>
                            <div className="truncate text-xs text-ui-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Btn size="sm" onClick={() => openEdit(u)}>Editar</Btn>
                            <Btn size="sm" onClick={() => (addToGroupUserId === u.id ? cancelAddToGroup() : openAddToGroup(u))}>Adicionar a grupo</Btn>
                            <Btn size="sm" variant="danger" onClick={() => deleteUser(u)} disabled={isSelf} title={isSelf ? 'Você não pode excluir a própria conta' : 'Excluir usuário'}>Excluir</Btn>
                          </div>
                        </div>
                        {addToGroupUserId === u.id && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-ui-hover p-2.5 sm:ml-[52px]">
                            <select className={`${selectCls} h-9 flex-1 min-w-[180px]`} value={addToGroupGroupId} onChange={(e) => setAddToGroupGroupId(e.target.value)}>
                              <option value="">Escolha o grupo...</option>
                              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <Btn size="sm" variant="primary" className="h-9" disabled={!addToGroupGroupId || addToGroupLoading} onClick={confirmAddToGroup}>{addToGroupLoading ? 'Adicionando...' : 'Adicionar'}</Btn>
                            <Btn size="sm" variant="ghost" className="h-9" onClick={cancelAddToGroup}>Cancelar</Btn>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <Empty>{query ? 'Nenhum usuário encontrado para essa busca.' : 'Nenhum usuário cadastrado.'}</Empty>
              )}
            </Card>
          </div>
        )}

        {/* ---------------- Grupos ---------------- */}
        {tab === 'grupos' && (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[360px_1fr]">
            <div className="flex flex-col gap-5">
              <Card title="Novo grupo" subtitle="Depois de criar, adicione os membros ao lado.">
                <form onSubmit={createGroup} className="flex gap-2">
                  <input className={inputCls} placeholder="Nome do grupo" value={gName} onChange={(e) => setGName(e.target.value)} />
                  <Btn type="submit" variant="primary">Criar</Btn>
                </form>
              </Card>
              <Card title="Grupos" subtitle={`${groups.length} grupo(s)`} actions={<Btn size="sm" onClick={refreshGroups}>Atualizar</Btn>}>
                {groups.length ? (
                  <ul className="-mx-2 flex max-h-[520px] flex-col gap-0.5 overflow-auto">
                    {groups.map((g) => {
                      const isActive = selectedGroup?.id === g.id
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => openGroup(g)}
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${isActive ? 'bg-ui-selected' : 'hover:bg-ui-hover'}`}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ui-avatar-group-bg text-ui-avatar-group-fg">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M12 12.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm-6.75-1.5a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25Zm13.5 0a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25ZM12 14.25c-3.04 0-5.625 1.69-5.625 3.938v.562c0 .414.336.75.75.75h9.75a.75.75 0 0 0 .75-.75v-.562c0-2.248-2.585-3.938-5.625-3.938Z" /></svg>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ui-text">{g.name}</span>
                              <span className="block truncate text-xs text-ui-muted">{g.memberCount ?? 0} membro(s) · {g.messageCount ?? 0} mensagem(ns)</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <Empty>Nenhum grupo criado ainda.</Empty>
                )}
              </Card>
            </div>

            <Card
              title={selectedGroup ? selectedGroup.name : 'Membros'}
              subtitle={selectedGroup ? `${members.length} membro(s)` : 'Selecione um grupo à esquerda para gerenciar os membros.'}
              actions={selectedGroup && (
                <>
                  <Btn size="sm" onClick={() => renameGroup(selectedGroup)}>Renomear</Btn>
                  <Btn size="sm" variant="danger" onClick={() => deleteGroup(selectedGroup)}>Excluir grupo</Btn>
                </>
              )}
            >
              {selectedGroup ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-end gap-2 rounded-xl bg-ui-hover p-3">
                    <Field label="Adicionar membro" className="min-w-[180px] flex-1">
                      <input className={`${inputCls} h-9`} placeholder="Filtrar pessoas..." value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
                    </Field>
                    <select className={`${selectCls} h-9 min-w-[220px] flex-1`} value={selectedUserToAdd} onChange={(e) => setSelectedUserToAdd(e.target.value)} aria-label="Pessoa a adicionar">
                      <option value="">{availableUsersFiltered.length ? 'Escolha a pessoa...' : 'Ninguém disponível'}</option>
                      {availableUsersFiltered.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                    </select>
                    <Btn variant="primary" className="h-9" disabled={!selectedUserToAdd || addingMember} onClick={addMember}>{addingMember ? 'Adicionando...' : 'Adicionar'}</Btn>
                  </div>

                  {membersLoading ? (
                    <div className="text-sm text-ui-muted">Carregando membros...</div>
                  ) : members.length ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Checkbox
                          checked={allMembersSelected}
                          onChange={() => setSelectedMemberIds(allMembersSelected ? [] : members.map((m) => m.userId))}
                          label={selectedMemberIds.length ? `${selectedMemberIds.length} selecionado(s)` : 'Selecionar todos'}
                        />
                        {selectedMemberIds.length > 0 && (
                          <Btn size="sm" variant="danger" disabled={removeBulkLoading} onClick={removeSelectedMembers}>{removeBulkLoading ? 'Removendo...' : 'Remover selecionados'}</Btn>
                        )}
                      </div>
                      <ul className="divide-y divide-ui-border">
                        {members.map((m) => (
                          <li key={m.userId} className="flex items-center gap-3 py-2.5">
                            <input type="checkbox" className="h-4 w-4 accent-[var(--ui-primary)]" checked={selectedMemberIds.includes(m.userId)} onChange={() => toggleSelectMember(m.userId)} aria-label={`Selecionar ${m.user?.name || ''}`} />
                            <UserAvatar name={m.user?.name} url={m.user?.avatarUrl} size={34} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-ui-text">{m.user?.name || m.userId}</div>
                              <div className="truncate text-xs text-ui-muted">{m.user?.email}</div>
                            </div>
                            <Btn size="sm" variant="ghost" onClick={() => removeMember(m)}>Remover</Btn>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <Empty>Este grupo ainda não tem membros.</Empty>
                  )}
                </div>
              ) : (
                <Empty>Nenhum grupo selecionado.</Empty>
              )}
            </Card>
          </div>
        )}

        {/* ---------------- Telefonia ---------------- */}
        {tab === 'telefonia' && (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[360px_1fr]">
            <Card title="Configurar ramal" subtitle="Cria ou atualiza a conta SIP de um usuário.">
              <form onSubmit={saveSip} className="flex flex-col gap-3">
                <Field label="Usuário">
                  <select className={selectCls} value={sipUserId} onChange={(e) => setSipUserId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}{sipUserIds.has(u.id) ? ' (já tem ramal)' : ''}</option>)}
                  </select>
                </Field>
                <Field label="Domínio"><input className={inputCls} placeholder="sip.empresa.com" value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ramal"><input className={inputCls} placeholder="1001" value={sipExtension} onChange={(e) => setSipExtension(e.target.value)} /></Field>
                  <Field label="Senha"><input className={inputCls} type="password" placeholder="Manter atual" value={sipPassword} onChange={(e) => setSipPassword(e.target.value)} autoComplete="new-password" /></Field>
                </div>
                <Btn type="submit" variant="primary" disabled={sipSaving} className="mt-1 w-full">{sipSaving ? 'Salvando...' : 'Salvar ramal'}</Btn>
              </form>
            </Card>

            <Card
              title="Ramais"
              subtitle={`${sipList.length} conta(s) SIP`}
              actions={
                <>
                  <input className={`${inputCls} h-9 w-56`} placeholder="Buscar nome, ramal, domínio..." value={sipQuery} onChange={(e) => setSipQuery(e.target.value)} />
                  <Btn size="sm" className="h-9" onClick={loadSip}>Atualizar</Btn>
                </>
              }
            >
              {sipError && <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{sipError}</div>}
              {sipLoading ? (
                <div className="text-sm text-ui-muted">Carregando...</div>
              ) : filteredSip.length ? (
                <ul className="divide-y divide-ui-border">
                  {filteredSip.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      {sipEditingId === a.user.id ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={a.user?.name} size={36} />
                            <div className="text-sm font-semibold text-ui-text">{a.user?.name}</div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input className={`${inputCls} h-9`} placeholder="Domínio" value={sipEdit.domain} onChange={(e) => setSipEdit((p) => ({ ...p, domain: e.target.value }))} />
                            <input className={`${inputCls} h-9`} placeholder="Ramal" value={sipEdit.extension} onChange={(e) => setSipEdit((p) => ({ ...p, extension: e.target.value }))} />
                            <input className={`${inputCls} h-9`} placeholder="Nova senha (opcional)" type="password" value={sipEdit.password} onChange={(e) => setSipEdit((p) => ({ ...p, password: e.target.value }))} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Btn size="sm" variant="ghost" onClick={cancelSipEdit} disabled={sipSaving}>Cancelar</Btn>
                            <Btn size="sm" variant="primary" onClick={saveSipEdit} disabled={sipSaving}>{sipSaving ? 'Salvando...' : 'Salvar'}</Btn>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <UserAvatar name={a.user?.name} size={36} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ui-text">{a.user?.name}</div>
                            <div className="truncate text-xs text-ui-muted">Ramal <span className="font-medium text-ui-text">{a.extension}</span> · {a.domain}</div>
                          </div>
                          <Badge tone={a.regRegistered ? 'green' : 'slate'}>{a.regRegistered ? 'Registrado' : a.regStatus || 'Desconectado'}</Badge>
                          <div className="flex items-center gap-1.5">
                            <Btn size="sm" onClick={() => openSipEdit(a)}>Editar</Btn>
                            <Btn size="sm" onClick={() => disconnectSip(a.user.id)} disabled={!a.regRegistered}>Desconectar</Btn>
                            <Btn size="sm" variant="danger" onClick={() => deleteSip(a.user.id)}>Excluir</Btn>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>{sipQuery ? 'Nenhum ramal encontrado para essa busca.' : 'Nenhum ramal configurado ainda.'}</Empty>
              )}
            </Card>
          </div>
        )}

        {/* ---------------- Métricas ---------------- */}
        {tab === 'metricas' && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ui-muted">Atividade das conversas em tempo real.</p>
              <Btn size="sm" onClick={loadMetrics} disabled={metricsLoading}>{metricsLoading ? 'Atualizando...' : 'Atualizar'}</Btn>
            </div>
            {metricsError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{metricsError}</div>}
            {!metrics && metricsLoading && <div className="text-sm text-ui-muted">Carregando métricas...</div>}
            {metrics && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat label="Usuários" value={formatNumber(metrics.totalUsers)} hint={`${formatNumber(metrics.activeUsersLast24Hours)} ativo(s) nas últimas 24h`} />
                  <Stat label="Grupos" value={formatNumber(metrics.totalGroups)} hint={`${formatNumber(metrics.totalGroupMembers)} participações`} />
                  <Stat label="Conversas diretas" value={formatNumber(metrics.totalDirectChats)} />
                  <Stat label="Mensagens" value={formatNumber(metrics.totalMessages)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat accent label="Online agora" value={formatNumber(metrics.onlineUsers)} hint={`${formatNumber(metrics.onlineSessions)} sessão(ões) abertas`} />
                  <Stat label="Mensagens nas últimas 24h" value={formatNumber(metrics.messagesLast24Hours)} />
                  <Stat label="Mensagens na última hora" value={formatNumber(metrics.messagesLastHour)} hint={`${formatDecimal(metrics.avgMessagesPerMinuteLastHour)} por minuto`} />
                  <Stat label="Conversas ativas" value={formatNumber(metrics.groupsActiveLastHour)} hint={`última hora · ${formatNumber(metrics.groupsActiveLast24Hours)} em 24h`} />
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Card title="Últimos 10 minutos" subtitle="Mensagens por minuto">
                    <div className="flex flex-col gap-2">
                      {metricsTimeline.list.map((bucket) => (
                        <div key={bucket.timestamp} className="flex items-center gap-3 text-xs">
                          <div className="w-11 text-right tabular-nums text-ui-muted">{bucket.label}</div>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ui-hover">
                            <div className="h-full rounded-full bg-ui-primary" style={{ width: `${(bucket.count / metricsTimeline.max) * 100}%` }} />
                          </div>
                          <div className="w-8 text-right font-semibold tabular-nums text-ui-text">{bucket.count}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Conversas mais ativas" subtitle="Últimas 24 horas">
                    {metrics.busiestGroups?.length ? (
                      <ol className="flex flex-col gap-2">
                        {metrics.busiestGroups.map((g, i) => (
                          <li key={g.groupId} className="flex items-center gap-3 rounded-xl bg-ui-hover px-3 py-2">
                            <span className="w-4 text-xs font-semibold text-ui-muted">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ui-text">{g.name}</span>
                            {g.isDirect && <Badge>Direta</Badge>}
                            <span className="text-xs tabular-nums text-ui-muted">{formatNumber(g.messages)} msg</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <Empty>Nenhuma conversa com mensagens neste período.</Empty>
                    )}
                    {metrics.lastMessage && (
                      <p className="mt-4 text-xs text-ui-muted">
                        Última mensagem em <span className="font-medium text-ui-text">{metrics.lastMessage.groupName || '—'}</span> por{' '}
                        <span className="font-medium text-ui-text">{metrics.lastMessage.authorName || '—'}</span> em {formatDateTime(metrics.lastMessage.createdAt)}.
                      </p>
                    )}
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------------- Configurações ---------------- */}
        {tab === 'configuracoes' && (
          <div className="mt-5 flex flex-col gap-5">
            <Card title="Aparência" subtitle="Vale para todos os usuários. O envio já salva e aplica na hora.">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    key: 'icon',
                    title: 'Ícone do chat',
                    hint: 'Aparece no menu lateral. Use uma imagem quadrada.',
                    preview: globalIconUrl ? <img src={globalIconUrl} alt="Ícone do chat" className="h-16 w-16 rounded-xl object-cover" /> : <span className="text-xs text-ui-muted">Padrão</span>,
                    inputRef: iconInputRef,
                    onFile: uploadGlobalIcon,
                    uploading: iconUploading,
                    hasValue: !!globalIconUrl,
                    onRemove: removeGlobalIcon,
                  },
                  {
                    key: 'logo',
                    title: 'Logo da tela de login',
                    hint: 'Exibida acima do formulário de login.',
                    preview: loginLogoUrl ? <img src={loginLogoUrl} alt="Logo do login" className="max-h-16 max-w-[140px] object-contain" /> : <span className="text-xs text-ui-muted">Sem logo</span>,
                    inputRef: loginLogoInputRef,
                    onFile: uploadLoginLogo,
                    uploading: loginLogoUploading,
                    hasValue: !!loginLogoUrl,
                    onRemove: deleteLoginLogo,
                  },
                  {
                    key: 'wallpaper',
                    title: 'Papel de parede',
                    hint: 'Fundo da área de mensagens. Sem imagem, o fundo fica liso.',
                    preview: globalWallpaperUrl ? <img src={globalWallpaperUrl} alt="Papel de parede" className="h-full w-full object-cover" /> : <span className="text-xs text-ui-muted">Fundo liso</span>,
                    inputRef: wallpaperInputRef,
                    onFile: uploadGlobalWallpaper,
                    uploading: wallpaperUploading,
                    hasValue: !!globalWallpaperUrl,
                    onRemove: deleteGlobalWallpaper,
                  },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col rounded-2xl border border-ui-border bg-ui-chat p-4">
                    <div className="text-sm font-semibold text-ui-text">{item.title}</div>
                    <div className="mt-0.5 text-xs text-ui-muted">{item.hint}</div>
                    <div className="mt-3 grid h-24 place-items-center overflow-hidden rounded-xl border border-dashed border-ui-border bg-ui-list">{item.preview}</div>
                    <input ref={item.inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { item.onFile(e.target.files?.[0]); e.target.value = '' }} />
                    <div className="mt-3 flex gap-2">
                      <Btn size="sm" variant="primary" className="flex-1" disabled={item.uploading} onClick={() => item.inputRef.current?.click()}>
                        {item.uploading ? 'Enviando...' : item.hasValue ? 'Trocar imagem' : 'Enviar imagem'}
                      </Btn>
                      {item.hasValue && <Btn size="sm" variant="danger" onClick={item.onRemove}>Remover</Btn>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Som de alerta" subtitle="Toca quando chega mensagem nova. Envie arquivos mp3, wav ou ogg.">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Nome do som (opcional)" className="min-w-[220px] flex-1">
                  <input className={inputCls} placeholder="Ex.: Alerta suave" value={soundName} onChange={(e) => setSoundName(e.target.value)} />
                </Field>
                <input ref={soundInputRef} type="file" accept="audio/*" className="hidden" onChange={onSoundSelected} />
                <Btn variant="primary" onClick={() => soundInputRef.current?.click()} disabled={soundUploading}>{soundUploading ? 'Enviando...' : 'Enviar som'}</Btn>
              </div>
              <ul className="mt-4 flex flex-col gap-2">
                <li className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${!activeAlertSoundId ? 'border-ui-primary/40 bg-ui-selected' : 'border-ui-border'}`}>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ui-text">Bip padrão</span>
                  {!activeAlertSoundId ? <Badge tone="blue">Em uso</Badge> : <Btn size="sm" onClick={() => activateSound(null)}>Usar</Btn>}
                </li>
                {alertSounds.map((sound) => {
                  const active = activeAlertSoundId === sound.id
                  return (
                    <li key={sound.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${active ? 'border-ui-primary/40 bg-ui-selected' : 'border-ui-border'}`}>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ui-text">{sound.name || 'Som'}</span>
                      <Btn size="sm" variant="ghost" onClick={() => previewSound(sound.url)}>Ouvir</Btn>
                      {active ? <Badge tone="blue">Em uso</Badge> : <Btn size="sm" onClick={() => activateSound(sound.id)}>Usar</Btn>}
                      <Btn size="sm" variant="danger" onClick={() => deleteSound(sound.id)} disabled={soundDeletingId === sound.id}>{soundDeletingId === sound.id ? 'Excluindo...' : 'Excluir'}</Btn>
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card title="E-mail (SMTP)" subtitle="Usado para enviar o link de redefinição de senha (“Esqueci minha senha”).">
              <form onSubmit={saveEmailConfig} className="flex flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_2fr]">
                  <Field label="Servidor SMTP"><input className={inputCls} placeholder="smtp.seudominio.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} /></Field>
                  <Field label="Porta"><input className={inputCls} type="number" min="1" max="65535" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} /></Field>
                  <Field label="Remetente"><input className={inputCls} placeholder="Suporte <suporte@empresa.com>" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} /></Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Usuário (opcional)"><input className={inputCls} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} autoComplete="off" /></Field>
                  <Field label="Senha" hint={smtpPasswordSet ? 'Já existe uma senha salva. Deixe em branco para manter.' : undefined}>
                    <input className={inputCls} type="password" placeholder={smtpPasswordSet ? '••••••••' : ''} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Checkbox checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} label="Conexão segura (SSL/TLS — normalmente porta 465)" />
                  <div className="flex gap-2">
                    <Btn onClick={testEmailConfig} disabled={smtpTesting}>{smtpTesting ? 'Verificando...' : 'Testar conexão'}</Btn>
                    <Btn type="submit" variant="primary" disabled={emailSaving}>{emailSaving ? 'Salvando...' : 'Salvar'}</Btn>
                  </div>
                </div>
              </form>
            </Card>

            <Card
              title="Backups"
              subtitle="Cópia do banco de dados e dos arquivos enviados. Restaurar substitui os dados atuais."
              actions={
                <>
                  <Btn size="sm" onClick={loadBackups} disabled={backupLoading}>{backupLoading ? 'Atualizando...' : 'Atualizar'}</Btn>
                  <Btn size="sm" variant="primary" onClick={runBackupNow} disabled={backupRunning}>{backupRunning ? 'Gerando backup...' : 'Fazer backup agora'}</Btn>
                </>
              }
            >
              <form onSubmit={saveBackupSchedule} className="flex flex-wrap items-end gap-3 rounded-xl bg-ui-hover p-3">
                <div className="flex h-10 items-center">
                  <Checkbox checked={!!backupSettings.autoEnabled} onChange={(e) => setBackupSettings((p) => ({ ...p, autoEnabled: e.target.checked }))} label="Backup automático diário" />
                </div>
                <Field label="Horário" className="w-32">
                  <input type="time" className={inputCls} value={backupSettings.time || '02:00'} onChange={(e) => setBackupSettings((p) => ({ ...p, time: e.target.value }))} disabled={!backupSettings.autoEnabled} />
                </Field>
                <Field label="Manter por (dias)" className="w-36">
                  <input type="number" min="0" max="365" className={inputCls} value={backupSettings.retentionDays ?? 7} onChange={(e) => setBackupSettings((p) => ({ ...p, retentionDays: Math.max(0, Number(e.target.value)) }))} disabled={!backupSettings.autoEnabled} />
                </Field>
                <Btn type="submit" variant="primary" disabled={backupSavingSettings}>{backupSavingSettings ? 'Salvando...' : 'Salvar agendamento'}</Btn>
              </form>
              <div className="mt-3 grid gap-1 text-xs text-ui-muted sm:grid-cols-3">
                <div>Último manual: <span className="text-ui-text">{formatDateTime(backupSettings.lastManualRunAt)}</span>{backupSettings.lastManualResult?.ok === false && <span className="text-red-500"> (falhou: {backupSettings.lastManualResult?.error || 'erro'})</span>}</div>
                <div>Último automático: <span className="text-ui-text">{formatDateTime(backupSettings.lastAutoRunAt)}</span>{backupSettings.lastAutoResult?.ok === false && <span className="text-red-500"> (falhou: {backupSettings.lastAutoResult?.error || 'erro'})</span>}</div>
                <div>Última restauração: <span className="text-ui-text">{formatDateTime(backupSettings.lastRestoreAt)}</span></div>
              </div>
              <div className="mt-4">
                {backupLoading && !backups.length ? (
                  <div className="text-sm text-ui-muted">Carregando backups...</div>
                ) : backups.length ? (
                  <div className="overflow-x-auto rounded-xl border border-ui-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-ui-hover text-left text-xs text-ui-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Criado em</th>
                          <th className="px-3 py-2 font-medium">Tamanho</th>
                          <th className="px-3 py-2 font-medium">Origem</th>
                          <th className="px-3 py-2 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-border">
                        {backups.map((item) => (
                          <tr key={item.name}>
                            <td className="px-3 py-2 text-ui-text" title={item.name}>{formatDateTime(item.createdAt)}</td>
                            <td className="px-3 py-2 tabular-nums text-ui-muted">{formatBytes(item.size)}</td>
                            <td className="px-3 py-2"><Badge tone={item?.meta?.reason === 'auto' ? 'slate' : 'blue'}>{item?.meta?.reason === 'auto' ? 'Automático' : 'Manual'}</Badge></td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1.5">
                                <Btn size="sm" onClick={() => downloadBackup(item.name)} disabled={backupDownloading === item.name}>{backupDownloading === item.name ? 'Baixando...' : 'Baixar'}</Btn>
                                <Btn size="sm" onClick={() => restoreBackupName(item.name)} disabled={!!backupRestoring}>{backupRestoring === item.name ? 'Restaurando...' : 'Restaurar'}</Btn>
                                <Btn size="sm" variant="danger" onClick={() => deleteBackupName(item.name)} disabled={backupDeleting === item.name}>{backupDeleting === item.name ? 'Excluindo...' : 'Excluir'}</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>Nenhum backup ainda. Use “Fazer backup agora” para criar o primeiro.</Empty>
                )}
              </div>
            </Card>

            <Card title="Minha senha" subtitle="Ao trocar, as sessões abertas em outros dispositivos são encerradas.">
              <form onSubmit={changeAdminPassword} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label="Senha atual"><input className={inputCls} type="password" value={admCurrentPwd} onChange={(e) => setAdmCurrentPwd(e.target.value)} autoComplete="current-password" /></Field>
                <Field label="Nova senha"><input className={inputCls} type="password" placeholder="Mín. 6 caracteres" value={admNewPwd} onChange={(e) => setAdmNewPwd(e.target.value)} autoComplete="new-password" /></Field>
                <Field label="Confirmar nova senha"><input className={inputCls} type="password" value={admNewPwd2} onChange={(e) => setAdmNewPwd2(e.target.value)} autoComplete="new-password" /></Field>
                <Btn type="submit" variant="primary" disabled={admPwdSaving}>{admPwdSaving ? 'Salvando...' : 'Alterar senha'}</Btn>
              </form>
            </Card>
          </div>
        )}
      </div>

      {/* ---------------- Modal: editar usuário ---------------- */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={closeEdit}>
          <div className="w-full max-w-lg rounded-2xl border border-ui-border bg-ui-list p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Editar usuário">
            <div className="mb-5 flex items-center gap-3">
              <UserAvatar name={editing.name} url={editing.avatarUrl} size={44} />
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ui-text">Editar usuário</h3>
                <p className="truncate text-xs text-ui-muted">{editing.email}</p>
              </div>
            </div>
            <form onSubmit={saveEdit} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><input className={inputCls} value={editing.name || ''} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} /></Field>
                <Field label="E-mail"><input className={inputCls} type="email" value={editing.email || ''} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} /></Field>
                <Field label="Telefone"><input className={inputCls} value={editing.phone || ''} onChange={(e) => setEditing((p) => ({ ...p, phone: formatBrPhone(e.target.value) }))} /></Field>
                <Field label="Endereço"><input className={inputCls} value={editing.address || ''} onChange={(e) => setEditing((p) => ({ ...p, address: e.target.value }))} /></Field>
              </div>
              <div className="flex flex-wrap gap-5 rounded-xl bg-ui-hover px-3 py-2.5">
                <Checkbox checked={!!editing.isAdmin} onChange={(e) => setEditing((p) => ({ ...p, isAdmin: e.target.checked }))} label="Administrador" disabled={editingSelf} title={editingSelf ? 'Você não pode remover seu próprio acesso de admin' : undefined} />
                <Checkbox checked={!!editing.isBlocked} onChange={(e) => setEditing((p) => ({ ...p, isBlocked: e.target.checked }))} label="Bloqueado" disabled={editingSelf} title={editingSelf ? 'Você não pode se bloquear' : undefined} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {editingSelf && (
                  <Field label="Sua senha atual"><input className={inputCls} type="password" value={selfCurrentPwd} onChange={(e) => setSelfCurrentPwd(e.target.value)} autoComplete="current-password" /></Field>
                )}
                <Field label="Nova senha (opcional)" hint={editingSelf ? undefined : 'A pessoa precisará entrar de novo.'} className={editingSelf ? '' : 'sm:col-span-2'}>
                  <input className={inputCls} type="password" placeholder="Deixe em branco para manter" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
              {editError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{editError}</div>}
              <div className="mt-2 flex justify-end gap-2">
                <Btn variant="ghost" onClick={closeEdit} disabled={editSaving}>Cancelar</Btn>
                <Btn type="submit" variant="primary" disabled={editSaving}>{editSaving ? 'Salvando...' : 'Salvar alterações'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
