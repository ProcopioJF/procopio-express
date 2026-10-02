import { useState } from 'react'
import PublicPortal from './pages/PublicPortal'
import LoginPage from './pages/LoginPage'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminDashboard from './pages/AdminDashboard'
import type { ApiUser } from './services/api'

export type AppView = 'public' | 'login' | 'company' | 'admin'

export default function App() {
  const [session, setSession] = useState<{ token: string; user: ApiUser } | null>(() => {
    try {
      const token = localStorage.getItem('px-auth-token')
      const user = localStorage.getItem('px-auth-user')
      return token && user ? { token, user: JSON.parse(user) as ApiUser } : null
    } catch {
      localStorage.removeItem('px-auth-token')
      localStorage.removeItem('px-auth-user')
      return null
    }
  })
  const [view, setView] = useState<AppView>(() => {
    return session?.user.role === 'ADMIN' ? 'admin' : session?.user.role === 'COMPANY' ? 'company' : 'public'
  })

  const handleLogin = (next: { token: string; user: ApiUser }) => {
    localStorage.setItem('px-auth-token', next.token)
    localStorage.setItem('px-auth-user', JSON.stringify(next.user))
    setSession(next)
    setView(next.user.role === 'ADMIN' ? 'admin' : 'company')
  }

  const handleLogout = () => {
    localStorage.removeItem('px-auth-token')
    localStorage.removeItem('px-auth-user')
    setSession(null)
    setView('login')
  }

  return (
    <div className="min-h-screen">
      {view === 'public' && (
        <PublicPortal
          onGoToLogin={() => setView('login')}
          token={session?.token}
          companyOrderMode={session?.user.role === 'COMPANY'}
          onGoToDashboard={session ? () => setView(session.user.role === 'ADMIN' ? 'admin' : 'company') : undefined}
        />
      )}
      {view === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onBack={() => setView('public')}
        />
      )}
      {view === 'company' && (
        session && <CompanyDashboard token={session.token} user={session.user} onLogout={handleLogout} onNewOrder={() => setView('public')} />
      )}
      {view === 'admin' && (
        session && <AdminDashboard token={session.token} user={session.user} onLogout={handleLogout} onNewOrder={() => setView('public')} />
      )}
    </div>
  )
}
