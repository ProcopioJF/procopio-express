import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield } from 'lucide-react'
import Logo from '../components/Logo'
import { loginRequest, type ApiUser } from '../services/api'

interface LoginPageProps {
  onLogin: (session: { token: string; user: ApiUser }) => void
  onBack: () => void
}

export default function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const session = await loginRequest(email, password)
      onLogin(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    setForgotMode(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f9fc] via-white to-[#eff7fc] flex items-center justify-center px-4 py-16 sm:py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-[#ff7a18]/10 blur-3xl pointer-events-none"/>
      <div className="absolute bottom-[-5%] left-[-5%] w-80 h-80 rounded-full bg-[#39b5ee]/15 blur-3xl pointer-events-none"/>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-5 left-4 sm:top-6 sm:left-6 flex items-center gap-2 text-[#64748b] hover:text-[#0f3266] text-sm font-500 transition-colors"
      >
        <ArrowLeft size={16}/> Portal Público
      </button>

      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_24px_70px_rgba(16,42,67,0.14)] ring-1 ring-[#e5eaf0] overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-[#0f3266] to-[#17447f] px-6 sm:px-8 py-6 sm:py-7 text-center">
            <div className="flex justify-center mb-4">
              <Logo variant="dark" className="h-12 object-contain"/>
            </div>
            <p className="text-white/75 text-sm font-500">Área Restrita · Procópio Express</p>
          </div>

          <div className="px-5 sm:px-8 py-6 sm:py-7">
            {forgotMode ? (
              (
                <div className="flex flex-col gap-5 animate-fade-in-up">
                  <div>
                    <h2 className="text-lg font-700 text-[#0f3266] mb-1">Recuperação de acesso</h2>
                    <p className="text-xs text-[#64748b]">Peça ao administrador da Procópio Express para gerar uma senha temporária e compartilhá-la por um canal seguro. Se sua conta for empresarial, altere a senha depois em Segurança da conta no painel.</p>
                  </div>
                  <button onClick={() => setForgotMode(false)} className="min-h-12 rounded-xl bg-[#ff7a18] text-sm font-700 text-white shadow-sm shadow-orange-200 hover:bg-[#e7650b]">
                    ← Voltar ao login
                  </button>
                </div>
              )
            ) : (
              <form
                className="flex flex-col gap-5 animate-fade-in-up"
                onSubmit={event => {
                  event.preventDefault()
                  void handleLogin()
                }}
              >
                <div>
                  <h2 className="text-lg font-700 text-[#0f3266] mb-1">Bem-vindo de volta</h2>
                  <p className="text-xs text-[#64748b]">Acesse seu painel de trabalho.</p>
                </div>

                {error && (
                  <div className="bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-xs font-600 px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <Shield size={13}/> {error}
                  </div>
                )}

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-xs font-600 text-[#64748b] uppercase tracking-wide">E-mail</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"/>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@empresa.com.br"
                      className="w-full h-12 pl-9 pr-4 rounded-xl border border-[#e5eaf0] bg-[#fbfdff] text-base text-[#102a43] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#39b5ee] focus:ring-4 focus:ring-[#39b5ee]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-password" className="text-xs font-600 text-[#64748b] uppercase tracking-wide">Senha</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"/>
                    <input
                      id="login-password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 pl-9 pr-10 rounded-xl border border-[#e5eaf0] bg-[#fbfdff] text-base text-[#102a43] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#39b5ee] focus:ring-4 focus:ring-[#39b5ee]/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors"
                    >
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="min-h-8 text-[11px] text-[#e7650b] font-600 text-right hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                {/* Main login */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-12 rounded-xl bg-[#ff7a18] text-white text-sm font-700 hover:bg-[#e7650b] disabled:opacity-60 transition-all shadow-[0_8px_20px_rgba(255,122,24,0.22)] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  ) : 'Entrar'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#e5eaf0]"/>
                  <span className="text-[10px] text-[#64748b] font-500 uppercase tracking-wider">Acesso rápido</span>
                  <div className="flex-1 h-px bg-[#e5eaf0]"/>
                </div>

              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[#64748b] text-xs mt-5 sm:mt-6">
          © 2025 Procópio Express · Juiz de Fora, MG
        </p>
      </div>
    </div>
  )
}
