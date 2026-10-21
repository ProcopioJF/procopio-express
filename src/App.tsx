import { lazy, Suspense, useEffect, useState } from 'react'
import PublicPortal from './pages/PublicPortal'
import LoginPage from './pages/LoginPage'
import {
  currentUserRequest,
  SESSION_EXPIRED_EVENT,
  SessionExpiredError,
  type ApiUser,
} from './services/api'

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
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(session))
  const [sessionMessage, setSessionMessage] = useState('')

  useEffect(() => {
    const token = session?.token
    let active = true
    const expireSession = () => {
      localStorage.removeItem('px-auth-token')
      localStorage.removeItem('px-auth-user')
      setSession(null)
      setView('login')
      setSessionMessage('Sua sessão expirou. Entre novamente.')
    }
    const handleSessionExpired = () => expireSession()

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)

    if (!token) {
      setIsCheckingSession(false)
      return () => {
        active = false
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
      }
    }

    setIsCheckingSession(true)
    currentUserRequest(token)
      .then(({ user }) => {
        if (!active) return
        localStorage.setItem('px-auth-user', JSON.stringify(user))
        setSession(current => current?.token === token ? { token, user } : current)
        setView(viewForRole(user.role))
      })
      .catch(error => {
        if (!active) return
        if (error instanceof SessionExpiredError) {
          expireSession()
        } else {
          setSessionMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível validar a sessão.',
          )
        }
      })
      .finally(() => {
        if (active) setIsCheckingSession(false)
      })

    return () => {
      active = false
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [session?.token])

  const handleLogin = (next: { token: string; user: ApiUser }) => {
    setSessionMessage('')
    setIsCheckingSession(true)
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
      {session && sessionMessage && !isCheckingSession && (
        <p
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
        >
          {sessionMessage} Atualize a página e tente novamente.
        </p>
      )}
      <Suspense fallback={null}>
        {!isCheckingSession && view === 'public' && (
          <PublicPortal
            onGoToLogin={() => setView('login')}
            token={session?.token}
            companyOrderMode={session?.user.role === 'COMPANY'}
            onGoToDashboard={session ? () => setView(viewForRole(session.user.role)) : undefined}
          />
        )}
        {!isCheckingSession && view === 'login' && (
          <LoginPage
            onLogin={handleLogin}
            onBack={() => setView('public')}
            notice={sessionMessage}
          />
        )}
        {!isCheckingSession && view === 'company' && (
          session && <CompanyDashboard token={session.token} user={session.user} onLogout={handleLogout} onNewOrder={() => setView('public')} />
        )}
        {!isCheckingSession && view === 'admin' && (
          session && <AdminDashboard token={session.token} user={session.user} onLogout={handleLogout} onNewOrder={() => setView('public')} />
        )}
        {!isCheckingSession && view === 'courier' && (
          session && <CourierDashboard token={session.token} name={session.user.name} onLogout={handleLogout} />
        )}
      </Suspense>
    </div>
  )
}
