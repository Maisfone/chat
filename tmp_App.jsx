import React, { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearAuth, getUser } from './state/auth.js'

export default function App() {
  const nav = useNavigate()
  const loc = useLocation()
  const user = getUser()
  const [userTick, setUserTick] = useState(0)
  useEffect(() => {
    const onUserUpdated = () => setUserTick(t => t + 1)
    window.addEventListener('chat:userUpdated', onUserUpdated)
    return () => window.removeEventListener('chat:userUpdated', onUserUpdated)
  }, [])
  const logout = () => { clearAuth(); nav('/login') }
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState(() => localStorage.getItem('chat_status') || 'online')
  const saveStatus = (s) => { setStatus(s); localStorage.setItem('chat_status', s) }
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [chatBg, setChatBg] = useState(() => localStorage.getItem('chat_bg') || 'whatsapp')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mini, setMini] = useState(true)
  const [chatIcon, setChatIcon] = useState(() => localStorage.getItem('chat_icon') || '')
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    if (theme === 'dark') { root.classList.add('dark'); body.classList.add('dark') }
    else { root.classList.remove('dark'); body.classList.remove('dark') }
    localStorage.setItem('theme', theme)
  }, [theme])
  useEffect(() => {
    const body = document.body
    try { body.setAttribute('data-chat-bg', chatBg) } catch {}
    localStorage.setItem('chat_bg', chatBg)
  }, [chatBg])
  useEffect(() => {
    const onIcon = () => setChatIcon(localStorage.getItem('chat_icon') || '')
    window.addEventListener('chat:iconUpdated', onIcon)
    return () => window.removeEventListener('chat:iconUpdated', onIcon)
  }, [])
  const isActive = (path) => (loc.pathname === path ? 'text-blue-600 font-semibold' : 'text-slate-700 hover:text-blue-600')
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      {/* Botão abrir sidebar (mobile) */}
      <button
        type="button"
        className="md:hidden fixed top-3 left-3 z-40 inline-flex items-center justify-center w-10 h-10 rounded-md bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow"
        aria-label="Abrir menu"
        onClick={() => setSidebarOpen(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M3.75 6.75h16.5v1.5H3.75v-1.5Zm0 4.5h16.5v1.5H3.75v-1.5Zm0 4.5h16.5v1.5H3.75v-1.5Z" />
        </svg>
      </button>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-16 md:w-16 border-r border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 flex flex-col z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between">
          {mini ? (
            chatIcon ? (
              <img src={chatIcon} alt="ícone do chat" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-300" />
            )
          ) : (
            <div className="flex items-center gap-2">
              {chatIcon && <img src={chatIcon} alt="ícone" className="w-6 h-6 rounded object-cover" />}
              <h3 className="font-semibold text-xl">Chat Farmacon</h3>
            </div>
          )}
          <div className="relative group hidden">
          <button type="button" className="inline-flex w-8 h-8 items-center justify-center rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/60" title={mini ? 'Expandir' : 'Recolher'} onClick={()=>{ const next=!mini; setMini(next); try{ localStorage.setItem('sidebar_mini', next ? '1' : '0') } catch {} }}>
            {mini ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4.5 12h15v1.5h-15V12Zm0-4.5h9V9h-9V7.5Zm0 9h9V18h-9v-1.5Z"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M9 6h10v1.5H9V6Zm0 10.5h10V18H9v-1.5ZM9 11.25h10v1.5H9v-1.5ZM5 6h2v12H5V6Z"/></svg>
            )}
          </button>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 shadow z-50 whitespace-nowrap dark:bg-slate-700">{mini ? 'Expandir' : 'Recolher'}</span>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-1">Olá, {user?.name}</div>
        {!mini && <div className="text-xs text-slate-500 mt-1">Olá, {user?.name}</div>}
        <nav className="mt-4 flex flex-col gap-2">
          <div className="relative group">
            <Link title="Conversas" className={`px-2 py-2 rounded flex items-center gap-2 ${isActive('/conversas')}`} to="/conversas">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3 5.25A2.25 2.25 0 0 1 5.25 3h8.5A2.25 2.25 0 0 1 16 5.25v6.5A2.25 2.25 0 0 1 13.75 14H8l-3.5 3.5V5.25Z"/></svg>
              {!mini && <span>Conversas</span>}
            </Link>
            {mini && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 shadow z-50 whitespace-nowrap dark:bg-slate-700">Conversas</span>
            )}
          </div>
          <div className="relative group">
            <Link title="Telefonia" className={`px-2 py-2 rounded flex items-center gap-2 ${isActive('/telefonia')}`} to="/telefonia">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.25 6.75c0-1.24 1.01-2.25 2.25-2.25h3c.97 0 1.8.62 2.1 1.54l.86 2.58a2.25 2.25 0 0 1-.57 2.31l-1.21 1.21a12.06 12.06 0 0 0 4.88 4.88l1.21-1.21a2.25 2.25 0 0 1 2.31-.57l2.58.86c.92.3 1.54 1.13 1.54 2.1v3c0 1.24-1.01 2.25-2.25 2.25H18c-8.28 0-15-6.72-15-15v-3Z"/></svg>
              {!mini && <span>Telefonia</span>}
            </Link>
            {mini && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 shadow z-50 whitespace-nowrap dark:bg-slate-700">Telefonia</span>
            )}
          </div>
          {user?.isAdmin && (
            <div className="relative group">
              <Link title="Admin" className={`px-2 py-2 rounded flex items-center gap-2 ${isActive('/admin')}`} to="/admin">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.25 3.75 6v5.25c0 5.108 3.66 9.837 8.625 10.5 4.965-.663 8.625-5.392 8.625-10.5V6L12 2.25Zm0 5.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm0 12a7.5 7.5 0 0 1-6-3.09c.03-1.982 4.5-3.06 6-3.06s5.97 1.078 6 3.06A7.5 7.5 0 0 1 12 19.5Z"/></svg>
                {!mini && <span>Admin</span>}
              </Link>
              {mini && (
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 shadow z-50 whitespace-nowrap dark:bg-slate-700">Admin</span>
              )}
            </div>
          )}
        </nav>
        {/* Menu inferior (lado esquerdo) */}
        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
          {mini ? (
            <div className="flex items-center justify-end">
              <div className="relative flex items-center gap-2">
                <button onClick={()=>setMenuOpen(v=>!v)} className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 dark:border-slate-600 hover:ring-2 hover:ring-blue-500/30">
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.style.display='none'}}/>
                    ) : (
                      <div className="w-full h-full bg-slate-300" />
                    )}
                  </div>
                  <span className={`absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${status==='online'?'bg-green-500':status==='ausente'?'bg-yellow-500':'bg-slate-400'}`}></span>
                </button>
                {menuOpen && (
                  <div className="fixed left-0 bottom-16 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow p-2 z-50">
                  <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">Status</div>
                  <div className="flex gap-2 px-2 py-1">
                    <button onClick={()=>saveStatus('online')} className={`px-2 py-1 rounded text-sm ${status==='online'?'bg-green-100 text-green-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Online</button>
                    <button onClick={()=>saveStatus('ausente')} className={`px-2 py-1 rounded text-sm ${status==='ausente'?'bg-yellow-100 text-yellow-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Ausente</button>
                    <button onClick={()=>saveStatus('offline')} className={`px-2 py-1 rounded text-sm ${status==='offline'?'bg-slate-100 text-slate-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Offline</button>
                  </div>
                  <div className="mt-2 border-t border-slate-200 dark:border-slate-700" />
                  <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">Tema</div>
                  <div className="flex gap-2 px-2 py-1">
                    <button onClick={()=>setTheme('light')} className={`px-2 py-1 rounded text-sm ${theme==='light'?'bg-slate-100 text-slate-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Claro</button>
                    <button onClick={()=>setTheme('dark')} className={`px-2 py-1 rounded text-sm ${theme==='dark'?'bg-slate-700 text-white':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Escuro</button>
                  </div>
                  
                  <div className="mt-2 border-t border-slate-200 dark:border-slate-700" />
                  <button onClick={()=>{ setMenuOpen(false); nav('/') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">Ir para Chat</button>
                  {user?.isAdmin && <button onClick={()=>{ setMenuOpen(false); nav('/admin') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">Ir para Admin</button>}
                  <button onClick={()=>{ setMenuOpen(false); nav('/profile') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50">Editar perfil</button>
                  <button onClick={logout} className="block w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">Sair</button>
                </div>
              )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${status==='online'?'bg-green-500':status==='ausente'?'bg-yellow-500':'bg-slate-400'}`}></span>
                <span className="text-sm text-slate-700 capitalize">{status}</span>
              </div>
              <div className="relative">
                <button onClick={()=>setMenuOpen(v=>!v)} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">
                  <img src={user?.avatarUrl} alt="avatar" className="w-6 h-6 rounded-full object-cover" onError={(e)=>{e.currentTarget.style.display='none'}}/>
                  <span>Menu</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 bottom-10 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow p-2 z-10">
                    <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">Status</div>
                    <div className="flex gap-2 px-2 py-1">
                      <button onClick={()=>saveStatus('online')} className={`px-2 py-1 rounded text-sm ${status==='online'?'bg-green-100 text-green-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Online</button>
                      <button onClick={()=>saveStatus('ausente')} className={`px-2 py-1 rounded text-sm ${status==='ausente'?'bg-yellow-100 text-yellow-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Ausente</button>
                      <button onClick={()=>saveStatus('offline')} className={`px-2 py-1 rounded text-sm ${status==='offline'?'bg-slate-100 text-slate-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Offline</button>
                    </div>
                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700" />
                    <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">Tema</div>
                    <div className="flex gap-2 px-2 py-1">
                      <button onClick={()=>setTheme('light')} className={`px-2 py-1 rounded text-sm ${theme==='light'?'bg-slate-100 text-slate-700':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Claro</button>
                      <button onClick={()=>setTheme('dark')} className={`px-2 py-1 rounded text-sm ${theme==='dark'?'bg-slate-700 text-white':'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>Escuro</button>
                    </div>
                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700" />
                    <button onClick={()=>{ setMenuOpen(false); nav('/') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">Ir para Chat</button>
                    {user?.isAdmin && <button onClick={()=>{ setMenuOpen(false); nav('/admin') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">Ir para Admin</button>}
                    <button onClick={()=>{ setMenuOpen(false); nav('/profile') }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50">Editar perfil</button>
                    <button onClick={logout} className="block w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">Sair</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Fechar (mobile) */}
        <div className="md:hidden mt-3">
          <button onClick={()=>setSidebarOpen(false)} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="m6.225 4.811 13.964 13.964-1.061 1.06L5.164 5.871l1.061-1.06Zm11.55 0 1.06 1.06L4.87 19.386l-1.06-1.06L17.776 4.81Z"/>
            </svg>
            Fechar
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden chat-bg">
        <Outlet />
      </main>
    </div>
  )
}

