import { lazy, Suspense, useState } from 'react'
import PublicPortal from './pages/PublicPortal'
import LoginPage from './pages/LoginPage'
import type { ApiUser } from './services/api'

const CompanyDashboard = lazy(() => import('./pages/CompanyDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const CourierDashboard = lazy(() => import('./pages/CourierDashboard'))

export type AppView = 'public' | 'login' | 'company' | 'admin' | 'courier'

const viewForRole = (role: ApiUser['role']): AppView =>
  role === 'ADMIN' ? 'admin' : role === 'COMPANY' ? 'company' : 'courier'

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
    return session ? viewForRole(session.user.role) : 'public'
  })

  const handleLogin = (next: { token: string; user: ApiUser }) => {
    localStorage.setItem('px-auth-token', next.token)
    localStorage.setItem('px-auth-user', JSON.stringify(next.user))
    setSession(next)
    setView(viewForRole(next.user.role))
  }

  const handleLogout = () => {
    localStorage.removeItem('px-auth-token')
    localStorage.removeItem('px-auth-user')
    setSession(null)
    setView('login')
  }

  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        {view === 'public' && (
          <PublicPortal
            onGoToLogin={() => setView('login')}
            token={session?.token}
            companyOrderMode={session?.user.role === 'COMPANY'}
            onGoToDashboard={session ? () => setView(viewForRole(session.user.role)) : undefined}
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
        {view === 'courier' && (
          session && <CourierDashboard token={session.token} name={session.user.name} onLogout={handleLogout} />
        )}
      </Suspense>
    </div>
  )
}
