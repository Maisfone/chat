import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearAuth, getUser } from './state/auth.js'
import { api, apiPublic } from './services/api.js'
import { ioClient } from './services/socket.js'
import { init as initSipBackground } from './services/sipBackground.js'

export default function App() {
  const nav = useNavigate()
  const loc = useLocation()
  const user = getUser()
  const setGlobalAlertSound = (url) => {
    try {
      if (url) localStorage.setItem('notif_sound_url', url);
      else localStorage.removeItem('notif_sound_url');
      window.dispatchEvent(new Event('chat:alertSoundUpdated'));
    } catch {}
  }

  const [userTick, setUserTick] = useState(0)
  useEffect(() => { 
    const onUserUpdated = () => setUserTick(t => t + 1)
    window.addEventListener('chat:userUpdated', onUserUpdated)
    return () => window.removeEventListener('chat:userUpdated', onUserUpdated)
  }, []) 
  // Wallpaper & icon: sync shared settings and load defaults
  useEffect(() => {
    const applyLocalWallpaper = () => {
      const stored = localStorage.getItem('chat_wallpaper') || ''
      if (stored) {
        document.documentElement.style.setProperty('--chat-wallpaper', `url('${stored}')`)
      } else {
        document.documentElement.style.removeProperty('--chat-wallpaper')
      }
    }
    const applyAlertSound = (url) => setGlobalAlertSound(url)

    applyLocalWallpaper()
    window.addEventListener('chat:wallpaperUpdated', applyLocalWallpaper)

    const loadPublicConfig = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL || `${window.location.origin}/api`).replace(/\/$/, '')
        const res = await fetch(`${base}/admin/config/public?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const pub = await res.json()

        const hasLocalWallpaper = !!(localStorage.getItem('chat_wallpaper') || '')
        if (!hasLocalWallpaper && pub?.chatWallpaperUrl) {
          document.documentElement.style.setProperty('--chat-wallpaper', `url('${pub.chatWallpaperUrl}')`)
        }
        if (pub && Object.prototype.hasOwnProperty.call(pub, 'alertSoundUrl')) {
          applyAlertSound(pub?.alertSoundUrl || '')
        }
        if (pub && Object.prototype.hasOwnProperty.call(pub, 'chatIconUrl')) {
          const url = pub?.chatIconUrl || ''
          setChatIcon(url)
          try {
            if (url) localStorage.setItem('chat_icon', url)
            else localStorage.removeItem('chat_icon')
            window.dispatchEvent(new Event('chat:iconUpdated'))
          } catch {}
        }
      } catch {}
    }

    loadPublicConfig()

    return () => window.removeEventListener('chat:wallpaperUpdated', applyLocalWallpaper)
  }, [])
  useEffect(() => {
    const s = ioClient()
    const onSound = (payload = {}) => {
      setGlobalAlertSound(payload?.url || '')
    }
    const onIcon = (payload = {}) => {
      const url = payload?.url || ''
      setChatIcon(url)
      try {
        if (url) localStorage.setItem('chat_icon', url)
        else localStorage.removeItem('chat_icon')
        window.dispatchEvent(new Event('chat:iconUpdated'))
      } catch {}
    }
    s.on('config:alert-sound', onSound)
    s.on('config:chat-icon', onIcon)
    return () => {
      s.off('config:alert-sound', onSound)
      s.off('config:chat-icon', onIcon)
    }
  }, [])

  // Initialize background SIP registration (keeps your extension online)
  useEffect(() => {
    initSipBackground().catch(()=>{})
  }, [])
  const logout = useCallback(() => {
    try {
      clearAuth()
    } catch {}
    setMenuOpen(false)
    nav('/login', { replace: true })
    // fallback em caso de navegação bloqueada
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }, 75)
  }, [nav])
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState(() => localStorage.getItem('chat_status') || 'online')
  const saveStatus = (s) => { setStatus(s); localStorage.setItem('chat_status', s) }
  const getStoredThemeMode = () => {
    if (typeof window === 'undefined') return 'auto'
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
    } catch {}
    return 'auto'
  }
  const getSystemPreference = () => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const [themeMode, setThemeMode] = useState(getStoredThemeMode)
  const [systemTheme, setSystemTheme] = useState(getSystemPreference)
  const appliedTheme = themeMode === 'auto' ? systemTheme : themeMode
  const isDarkMode = appliedTheme === 'dark'
  const [chatBg, setChatBg] = useState(() => localStorage.getItem('chat_bg') || 'whatsapp')
  const getStoredMini = () => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('sidebar_mini') === '1'
    } catch {
      return false
    }
  }
  const [mini, setMini] = useState(getStoredMini)
  const [chatIcon, setChatIcon] = useState(() => localStorage.getItem('chat_icon') || '')
  const avatarInputRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')
  const [avatarErr, setAvatarErr] = useState('')
  const profileMenuRootRef = useRef(null)
  const setProfileMenuRoot = useCallback((node) => {
    profileMenuRootRef.current = node
  }, [])
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const statusMenuRef = useRef(null)
  // Total de não lidas (publicado pela tela de conversas) para o badge do menu
  const [unreadTotal, setUnreadTotal] = useState(0)
  useEffect(() => {
    const onTotal = (e) => setUnreadTotal(Number(e?.detail) || 0)
    window.addEventListener('chat:unreadTotal', onTotal)
    return () => window.removeEventListener('chat:unreadTotal', onTotal)
  }, [])
  useEffect(() => {
    if (!statusMenuOpen) return
    const close = (event) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) setStatusMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [statusMenuOpen])
  const toggleMini = () => {
    setMini((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_mini', next ? '1' : '0')
      } catch {}
      return next
    })
  }
  const handleOpenChatList = useCallback(() => {}, [])
  const applyThemeMode = (mode) => {
    setThemeMode(mode)
    try {
      window.dispatchEvent(new Event("chat:themeChanged"))
    } catch {}
  }
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const darkMode = appliedTheme === 'dark'
    root.classList.toggle('dark', darkMode)
    body.classList.toggle('dark', darkMode)
  }, [appliedTheme])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    handleChange(media)
    if (media.addEventListener) {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }
    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('theme', themeMode)
    } catch {}
  }, [themeMode])
  useEffect(() => {
    const body = document.body
    try { body.setAttribute('data-chat-bg', chatBg) } catch {}
    localStorage.setItem('chat_bg', chatBg)
  }, [chatBg])
  useEffect(() => {
    const handleIcon = () => setChatIcon(localStorage.getItem('chat_icon') || '');
    const handleBg = () => setChatBg(localStorage.getItem('chat_bg') || 'whatsapp');
    window.addEventListener('chat:iconUpdated', handleIcon);
    window.addEventListener('chat:bgUpdated', handleBg);
    return () => {
      window.removeEventListener('chat:iconUpdated', handleIcon);
      window.removeEventListener('chat:bgUpdated', handleBg);
    };
  }, [])

  // Presence: announce online and propagate status changes
  useEffect(() => {
    const s = ioClient();
    const uid = getUser()?.id;
    if (!uid) return;
    try { s.emit('presence:online', { userId: uid, status }) } catch {}
  // run on mount and when user changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  useEffect(() => {
    const s = ioClient();
    const uid = getUser()?.id;
    if (!uid) return;
    try { s.emit('presence:set', { status }) } catch {}
  }, [status])

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (event) => {
      const root = profileMenuRootRef.current
      if (!root) return
      if (!root.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [menuOpen])

  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      setAvatarErr('Escolha um arquivo de imagem')
      event.target.value = ''
      return
    }
    setAvatarMsg('')
    setAvatarErr('')
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const res = await api.uploadPatch('/users/me', form)
      const updated = res?.user || res
      if (updated?.avatarUrl) {
        try {
          const raw = localStorage.getItem('chat_auth')
          if (raw) {
            const data = JSON.parse(raw)
            data.user = { ...(data.user || {}), avatarUrl: updated.avatarUrl }
            localStorage.setItem('chat_auth', JSON.stringify(data))
          }
        } catch {}
        window.dispatchEvent(new Event('chat:userUpdated'))
        setAvatarMsg('Foto atualizada com sucesso')
      } else {
        setAvatarMsg('Foto atualizada')
      }
      setMenuOpen(false)
    } catch (err) {
      setAvatarErr(err?.message || 'Falha ao enviar foto')
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  const triggerAvatarPicker = () => {
    setAvatarErr('')
    setAvatarMsg('')
    avatarInputRef.current?.click()
  }

  const statusOptions = [
    { key: 'online', label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-500' },
    { key: 'ausente', label: 'Ausente', dot: 'bg-amber-500', text: 'text-amber-500' },
    { key: 'offline', label: 'Offline', dot: 'bg-slate-400', text: 'text-slate-400' },
  ]
  const currentStatus = statusOptions.find((o) => o.key === status) || statusOptions[0]

  const menuItemClass =
    'w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-ui-text hover:bg-ui-hover'
  const renderMenuPanel = (positionClass) => (
    <div
      className={`${positionClass} w-64 rounded-xl border border-ui-border bg-ui-sidebar p-2 text-ui-text shadow-xl shadow-slate-900/10 z-50 dark:shadow-black/40`}
    >
      <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ui-muted">Status</div>
      <div className="flex gap-1 px-1.5 pb-2">
        {statusOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => saveStatus(opt.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
              status === opt.key ? 'border-ui-primary/40 bg-ui-selected text-ui-text' : 'border-ui-border text-ui-muted hover:bg-ui-hover'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
            {opt.label}
          </button>
        ))}
      </div>
      <div className="border-t border-ui-border" />
      <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ui-muted">Tema</div>
      <div className="flex gap-1 px-1.5 pb-2">
        {[
          { key: 'light', label: 'Claro' },
          { key: 'dark', label: 'Escuro' },
          { key: 'auto', label: 'Sistema' },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => applyThemeMode(option.key)}
            className={`flex-1 rounded-lg border px-2 py-1 text-xs ${
              themeMode === option.key
                ? 'border-transparent bg-ui-primary text-white'
                : 'border-ui-border text-ui-muted hover:bg-ui-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="border-t border-ui-border" />
      <div className="flex flex-col gap-0.5 p-1">
        <button type="button" onClick={triggerAvatarPicker} disabled={avatarUploading} className={`${menuItemClass} disabled:opacity-50`}>
          {avatarUploading ? 'Enviando foto...' : 'Alterar foto'}
        </button>
        <button type="button" onClick={() => { setMenuOpen(false); nav('/profile') }} className={menuItemClass}>Editar perfil</button>
        <button type="button" onClick={() => { setMenuOpen(false); toggleMini() }} className={menuItemClass}>
          {mini ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        </button>
        <button type="button" onClick={logout} className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-red-500 hover:bg-red-500/10">Sair</button>
      </div>
    </div>
  )

  const navItems = [
    {
      to: '/conversas',
      label: 'Conversas',
      badge: unreadTotal,
      icon: <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.112l-3.826 1.067a1.25 1.25 0 0 1-1.54-1.54l1.068-3.823A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2Zm-3.25 11a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0-3.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" />,
    },
    {
      to: '/telefonia',
      label: 'Telefonia',
      icon: <path d="M2.25 6.75c0-1.24 1.01-2.25 2.25-2.25h3c.97 0 1.8.62 2.1 1.54l.86 2.58a2.25 2.25 0 0 1-.57 2.31l-1.21 1.21a12.06 12.06 0 0 0 4.88 4.88l1.21-1.21a2.25 2.25 0 0 1 2.31-.57l2.58.86c.92.3 1.54 1.13 1.54 2.1v3c0 1.24-1.01 2.25-2.25 2.25H18c-8.28 0-15-6.72-15-15v-3Z" />,
    },
    {
      to: '/reunioes',
      label: 'Reuniões',
      icon: <path d="M6.75 2a.75.75 0 0 1 .75.75V4h9V2.75a.75.75 0 0 1 1.5 0V4h.75A2.25 2.25 0 0 1 21 6.25v11A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25v-11A2.25 2.25 0 0 1 5.25 4H6V2.75a.75.75 0 0 1 .75-.75ZM19.5 10.5h-15V17.25c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75V10.5Zm-9.75 2.25a.75.75 0 0 1 .102 1.493L9.75 14.25h-2.5a.75.75 0 0 1-.102-1.493l.102-.007h2.5Zm6 0a.75.75 0 0 1 .102 1.493l-.102.007h-3.5a.75.75 0 0 1-.102-1.493l.102-.007h3.5Z" />,
    },
    ...(user?.isAdmin
      ? [{
          to: '/admin',
          label: 'Admin',
          icon: <path fillRule="evenodd" clipRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25z" />,
        }]
      : []),
    {
      to: '/contatos',
      label: 'Contatos',
      icon: <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V5.25A2.25 2.25 0 0 0 18.75 3H5.25Zm6.75 4.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm0 6c2.209 0 4.5 1.122 4.5 2.5V17H7.5v-1c0-1.378 2.291-2.5 4.5-2.5Z" />,
    },
  ]
  const isNavActive = (path) =>
    path === '/conversas' ? loc.pathname === '/' || loc.pathname === '/conversas' : loc.pathname === path

  const logo = chatIcon ? (
    <img src={chatIcon} alt="ícone do chat" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ui-primary text-white shadow-md shadow-blue-600/30">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M7.5 18.5 4 20l1.2-3.4A7.5 7.5 0 1 1 7.5 18.5Z" />
        <path d="M8.5 10.5h7M8.5 13.5h4.5" />
      </svg>
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ui-sidebar bg-emerald-500" />
    </span>
  )

  const userAvatar = (sizeClass) => (
    <span className={`relative shrink-0 ${sizeClass}`}>
      <span className="block h-full w-full overflow-hidden rounded-full bg-ui-primary">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt="avatar"
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {user?.name?.slice(0, 2)?.toUpperCase() || 'EU'}
          </span>
        )}
      </span>
      {mini && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ui-sidebar ${currentStatus.dot}`} />}
    </span>
  )

  return (
    <div className="flex h-screen overflow-x-hidden bg-ui-sidebar text-ui-text">
      <aside
        className={`${mini ? 'w-[72px] px-2' : 'w-56 px-4'} flex flex-shrink-0 flex-col border-r border-ui-border bg-ui-sidebar py-4 z-40`}
      >
        {/* Cabeçalho: logo + saudação + status */}
        {mini ? (
          <div className="flex flex-col items-center gap-2">
            {logo}
            <button
              type="button"
              onClick={toggleMini}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ui-icon hover:bg-ui-hover"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {logo}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-base font-semibold tracking-tight">Chat</div>
              <div className="truncate text-[11px] text-ui-muted">Olá, {user?.name?.split(' ')[0]}</div>
            </div>
            <div ref={statusMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setStatusMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-input px-2 py-0.5 text-[11px] font-medium text-ui-text hover:bg-ui-hover"
                aria-haspopup="menu"
                aria-expanded={statusMenuOpen}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
                {currentStatus.label}
                <svg viewBox="0 0 24 24" fill="currentColor" className={`h-3 w-3 text-ui-muted transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`}><path d="M12 15.75a.75.75 0 0 1-.53-.22l-4.5-4.5a.75.75 0 1 1 1.06-1.06L12 13.94l3.97-3.97a.75.75 0 0 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-.53.22Z" /></svg>
              </button>
              {statusMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-36 rounded-xl border border-ui-border bg-ui-sidebar p-1 shadow-xl shadow-slate-900/10 dark:shadow-black/40" role="menu">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="menuitem"
                      onClick={() => { saveStatus(opt.key); setStatusMenuOpen(false) }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-ui-hover ${status === opt.key ? 'font-semibold text-ui-text' : 'text-ui-muted'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navegação */}
        <nav className="mt-5 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isNavActive(item.to)
            return (
              <div key={item.to} className="group relative">
                <Link
                  to={item.to}
                  title={item.label}
                  onClick={item.to === '/conversas' ? handleOpenChatList : undefined}
                  className={`relative flex w-full items-center rounded-xl text-sm font-medium transition-colors ${
                    mini ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
                  } ${
                    active
                      ? 'bg-ui-nav-active text-ui-nav-active-text'
                      : 'text-ui-icon hover:bg-ui-hover hover:text-ui-text dark:text-slate-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
                    {item.icon}
                  </svg>
                  {!mini && <span className="flex-1">{item.label}</span>}
                  {item.badge > 0 && (
                    <span
                      className={`inline-flex min-w-[22px] items-center justify-center rounded-md bg-ui-primary px-1.5 text-[11px] font-semibold leading-5 text-white ${
                        mini ? 'absolute right-1 top-1 min-w-[18px] rounded-full px-1 leading-[18px]' : ''
                      }`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
                {mini && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                    {item.label}
                  </span>
                )}
              </div>
            )
          })}
        </nav>

        {/* Usuário */}
        <div className="mt-auto border-t border-ui-border pt-4">
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelected} />
          <div ref={setProfileMenuRoot} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex w-full items-center rounded-xl border border-ui-border bg-ui-input/60 text-left hover:bg-ui-hover dark:bg-ui-list ${
                mini ? 'justify-center p-1.5' : 'gap-3 px-2.5 py-2'
              }`}
              aria-expanded={menuOpen}
              aria-label="Abrir menu do perfil"
            >
              {userAvatar('h-9 w-9')}
              {!mini && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ui-text">{user?.name || 'Meu perfil'}</span>
                    <span className={`block truncate text-xs font-medium ${currentStatus.text}`}>{currentStatus.label}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 text-ui-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                    <path d="M12 15.75a.75.75 0 0 1-.53-.22l-4.5-4.5a.75.75 0 1 1 1.06-1.06L12 13.94l3.97-3.97a.75.75 0 0 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-.53.22Z" />
                  </svg>
                </>
              )}
            </button>
            {menuOpen && renderMenuPanel(mini ? 'absolute left-full bottom-0 ml-2' : 'absolute left-0 bottom-full mb-2')}
          </div>
          {(avatarMsg || avatarErr) && !mini && (
            <div className={`mt-2 text-xs ${avatarErr ? 'text-red-500' : 'text-emerald-500'}`}>{avatarErr || avatarMsg}</div>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
