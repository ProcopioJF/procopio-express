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
      if (session.user.role === 'COURIER') {
        setError('O acesso de motoboy ainda não está disponível neste painel.')
        return
      }
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
    <div className="min-h-screen bg-gradient-to-br from-[#080f2a] via-[#0c225a] to-[#163690] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-[#f47b20]/10 blur-3xl pointer-events-none"/>
      <div className="absolute bottom-[-5%] left-[-5%] w-80 h-80 rounded-full bg-[#38b6ff]/10 blur-3xl pointer-events-none"/>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white text-sm font-500 transition-colors"
      >
        <ArrowLeft size={16}/> Portal Público
      </button>

      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-[#0c225a] to-[#163690] px-8 py-7 text-center">
            <div className="flex justify-center mb-4">
              <Logo variant="dark" className="h-12 object-contain"/>
            </div>
            <p className="text-white/60 text-sm font-500">Área Restrita · Empresas Parceiras</p>
          </div>

          <div className="px-8 py-7">
            {forgotMode ? (
              (
                <div className="flex flex-col gap-5 animate-fade-in-up">
                  <div>
                    <h2 className="text-lg font-700 text-[#0c225a] mb-1">Recuperação de acesso</h2>
                    <p className="text-xs text-[#64748b]">A recuperação automática por e-mail ainda não está configurada. Peça ao administrador da Procópio Express para redefinir sua senha.</p>
                  </div>
                  <button onClick={() => setForgotMode(false)} className="h-11 rounded-xl bg-[#f47b20] text-sm font-700 text-white hover:bg-[#d96810]">
                    ← Voltar ao login
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-5 animate-fade-in-up">
                <div>
                  <h2 className="text-lg font-700 text-[#0c225a] mb-1">Bem-vindo de volta</h2>
                  <p className="text-xs text-[#64748b]">Acesse o painel da sua empresa.</p>
                </div>

                {error && (
                  <div className="bg-[#fee2e2] text-[#ef4444] text-xs font-600 px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <Shield size={13}/> {error}
                  </div>
                )}

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-[#64748b] uppercase tracking-wide">E-mail</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"/>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@empresa.com.br"
                      className="w-full h-11 pl-9 pr-4 rounded-xl border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#f47b20] focus:ring-2 focus:ring-[#f47b20]/15 transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-[#64748b] uppercase tracking-wide">Senha</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"/>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-9 pr-10 rounded-xl border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#f47b20] focus:ring-2 focus:ring-[#f47b20]/15 transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
                    onClick={() => setForgotMode(true)}
                    className="text-[10px] text-[#f47b20] font-600 text-right hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                {/* Main login */}
                <button
                  onClick={() => handleLogin()}
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#f47b20] text-white text-sm font-700 hover:bg-[#d96810] disabled:opacity-60 transition-all shadow-lg shadow-[#f47b20]/25 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  ) : 'Entrar'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#e2e8f0]"/>
                  <span className="text-[10px] text-[#94a3b8] font-500 uppercase tracking-wider">Acesso rápido</span>
                  <div className="flex-1 h-px bg-[#e2e8f0]"/>
                </div>

              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © 2025 Procópio Express · Juiz de Fora, MG
        </p>
      </div>
    </div>
  )
}
