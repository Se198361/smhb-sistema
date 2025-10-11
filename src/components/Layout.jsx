import { Link, NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const [dark, setDark] = useState(false)
  const logoSrc = import.meta.env.VITE_LOGO_URL || '/smhb-logo.png'
  const { user, signOut } = useAuth()

  useEffect(() => {
    const persisted = localStorage.getItem('theme-dark') === 'true'
    setDark(persisted)
    document.documentElement.classList.toggle('dark', persisted)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme-dark', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <div className="min-h-screen">
      <header className="glass-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt="SMHB Remidos do Senhor"
              className="logo-glow h-10 w-10 object-contain rounded-md border border-primary/40"
              onError={(e) => { e.currentTarget.src = '/vite.svg' }}
            />
            <span className="dot dot-muted" aria-hidden="true" />
            <Link to="/" className="font-montserrat text-xl font-bold text-primary dark:text-light soft-link">SMHB Remidos do Senhor</Link>
            <span className="badge badge-muted">Sistema v1.0</span>
          </div>
          <nav className="flex gap-4 items-center">
            <NavLink to="/dashboard" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Dashboard</NavLink>
            <NavLink to="/membros" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Membros</NavLink>
            <NavLink to="/financas" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Finanças</NavLink>
            <NavLink to="/eventos" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Eventos</NavLink>
            <NavLink to="/conteudo" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Conteúdo</NavLink>
            <NavLink to="/avisos" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Avisos</NavLink>
            <NavLink to="/crachas" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Crachás</NavLink>
            <NavLink to="/diretoria" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Diretoria</NavLink>
            {!user && (
              <NavLink to="/cadastro" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Cadastro</NavLink>
            )}
            <button onClick={toggleTheme} className="ml-2 btn-neon text-sm">
              {dark ? 'Claro' : 'Escuro'}
            </button>
            {user ? (
              <div className="flex items-center gap-2 ml-3">
                <span className="text-sm text-primary dark:text-light font-semibold">{user.user_metadata?.name || user.email}</span>
                <button onClick={signOut} className="btn-neon text-xs px-2 py-1">Sair</button>
              </div>
            ) : (
              <NavLink to="/login" className={({ isActive }) => `${isActive ? 'text-accent' : 'text-primary dark:text-light'} soft-link`}>Entrar</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 fade-up">
        <Outlet />
      </main>
      <footer className="mt-10 py-6 text-center text-sm text-gray-700 dark:text-gray-300">
        © {new Date().getFullYear()} SMHB Remidos do Senhor
      </footer>
    </div>
  )
}