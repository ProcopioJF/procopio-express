import { useCallback, useEffect, useState, type FormEvent } from "react"
import type { InputHTMLAttributes } from "react"
import { Plus, RefreshCw } from "lucide-react"
import {
  changePasswordRequest,
  createCompanyBranch,
  createCompanyCostCenter,
  createCompanyMember,
  getCompanyOrganization,
  updateCompanyBranch,
  updateCompanyCostCenter,
  updateCompanyMember,
  type ApiBranch,
  type ApiCompanySettings,
  type ApiCostCenter,
  type ApiOrganization,
  type ApiUser,
} from "../services/api"

type Tab = "profile" | "users" | "cost-centers" | "branches"
type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string }

function Input({ label, ...props }: InputProps) {
  return (
    <label className="block text-xs font-semibold text-[#718096]">
      {label}
      <input {...props} className={`mt-1 block h-10 w-full rounded-xl border border-[#e2e8f4] bg-[#fbfcfe] px-3 text-sm text-[#102b55] outline-none focus:border-[#f47b20] ${props.className ?? ""}`} />
    </label>
  )
}

export default function CompanyOrganizationPanel({
  token,
  user,
  profile,
  savingProfile,
  onProfileChange,
  onSaveProfile,
  onFeedback,
}: {
  token: string
  user: ApiUser
  profile: ApiCompanySettings
  savingProfile: boolean
  onProfileChange: (profile: ApiCompanySettings) => void
  onSaveProfile: () => void
  onFeedback: (error: string, notice?: string) => void
}) {
  const [tab, setTab] = useState<Tab>("profile")
  const [organization, setOrganization] = useState<ApiOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [memberForm, setMemberForm] = useState({ name: "", email: "", phone: "", password: "", companyPermission: "STANDARD" as NonNullable<ApiUser["companyPermission"]> })
  const [branchForm, setBranchForm] = useState({ name: "", phone: "", address: "" })
  const [costCenterForm, setCostCenterForm] = useState({ name: "", code: "" })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCompanyOrganization(token)
      setOrganization(result.organization)
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "Não foi possível carregar a estrutura da empresa.")
    } finally {
      setLoading(false)
    }
  }, [onFeedback, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true)
    onFeedback("")
    try {
      await operation()
      await refresh()
      setShowForm(false)
      onFeedback("", success)
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "Não foi possível salvar as alterações.")
    } finally {
      setSaving(false)
    }
  }

  const member = organization?.members.find((item) => item.id === user.id)
  const canManage = member?.companyPermission === "ADMIN"

  const submitMember = (event: FormEvent) => {
    event.preventDefault()
    void run(() => createCompanyMember(token, memberForm), "Usuário da empresa criado.")
  }

  const submitBranch = (event: FormEvent) => {
    event.preventDefault()
    void run(() => createCompanyBranch(token, branchForm), "Filial cadastrada.")
  }

  const submitCostCenter = (event: FormEvent) => {
    event.preventDefault()
    void run(() => createCompanyCostCenter(token, costCenterForm), "Centro de custo cadastrado.")
  }

  const submitPassword = (event: FormEvent) => {
    event.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      onFeedback("A confirmação da nova senha não corresponde.")
      return
    }
    void run(
      () => changePasswordRequest(token, passwordForm.currentPassword, passwordForm.newPassword),
      "Senha atualizada.",
    ).then(() => setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }))
  }

  const tabs: Array<[Tab, string]> = [
    ["profile", "Dados Cadastrais"],
    ["users", "Usuários"],
    ["cost-centers", "Centros de Custo"],
    ["branches", "Filiais"],
  ]
  const formClass = "grid gap-3 rounded-2xl border border-[#e8edf4] bg-white p-4 md:grid-cols-2"
  const buttonClass = "flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f47b20] px-4 text-xs font-bold text-white disabled:opacity-50"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#102b55]">Perfil da empresa</h2>
          <p className="mt-1 text-xs text-[#718096]">
            {organization?.company.name || profile.name || user.name}
            {organization?.company.document ? ` · ${organization.company.document}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {(tab !== "profile" && canManage) && (
            <button onClick={() => setShowForm((value) => !value)} className="flex h-9 items-center gap-2 rounded-xl bg-[#f47b20] px-3 text-xs font-bold text-white">
              <Plus size={14} /> Adicionar
            </button>
          )}
          <button onClick={() => void refresh()} aria-label="Atualizar estrutura da empresa" className="grid h-9 w-9 place-items-center rounded-xl border border-[#e8edf4] bg-white text-[#718096]">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#e8edf4]">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setShowForm(false) }} className={`border-b-2 px-3 py-2 text-xs font-bold ${tab === id ? "border-[#f47b20] text-[#c76216]" : "border-transparent text-[#718096]"}`}>
            {label}
          </button>
        ))}
      </div>
      {loading && <p className="text-xs text-[#718096]">Carregando perfil e estrutura...</p>}

      {tab === "profile" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#e8edf4] bg-white p-6">
            <h3 className="font-bold text-[#102b55]">Dados cadastrais</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ["name", "Nome da empresa"],
                ["document", "CNPJ ou documento"],
                ["phone", "Telefone"],
                ["email", "E-mail"],
                ["address", "Endereço"],
              ] as const).map(([key, label]) => (
                <Input key={key} label={label} value={profile[key]} onChange={(event) => onProfileChange({ ...profile, [key]: event.target.value })} />
              ))}
            </div>
            {canManage ? (
              <button disabled={savingProfile} onClick={onSaveProfile} className="mt-5 rounded-xl bg-[#0c225a] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {savingProfile ? "Salvando…" : "Salvar perfil"}
              </button>
            ) : <p className="mt-5 text-xs text-[#718096]">Somente administradores da empresa podem alterar o cadastro.</p>}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e8edf4] bg-white p-5">
              <h3 className="font-bold text-[#102b55]">Plano atual</h3>
              {organization?.subscription ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{organization.subscription.plan.name}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${organization.subscription.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {organization.subscription.status === "ACTIVE" ? "Ativo" : "Vencido"}
                  </span>
                </div>
              ) : <p className="mt-3 text-sm text-[#718096]">Nenhuma assinatura ativa cadastrada.</p>}
            </div>
            <div className="rounded-2xl border border-[#e8edf4] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="font-bold text-[#102b55]">Segurança da conta</h3><p className="mt-1 text-xs text-[#718096]">Atualize sua senha de acesso.</p></div>
                <button onClick={() => setShowPasswordForm((value) => !value)} className="rounded-lg border border-[#e8edf4] px-3 py-2 text-xs font-bold text-[#102b55]">{showPasswordForm ? "Cancelar" : "Alterar senha"}</button>
              </div>
              {showPasswordForm && <form onSubmit={submitPassword} className="mt-4 space-y-3">
                <Input label="Senha atual" type="password" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
                <Input label="Nova senha (mínimo 12 caracteres)" type="password" minLength={12} required value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
                <Input label="Confirmar nova senha" type="password" minLength={12} required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
                <button disabled={saving} className={buttonClass}>Atualizar senha</button>
              </form>}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <>
          {!canManage && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Você tem acesso de consulta. Um administrador da empresa pode gerenciar usuários e permissões.</p>}
          {showForm && canManage && <form onSubmit={submitMember} className={formClass}>
            <Input label="Nome" required value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} />
            <Input label="E-mail" type="email" required value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} />
            <Input label="Telefone" value={memberForm.phone} onChange={(event) => setMemberForm({ ...memberForm, phone: event.target.value })} />
            <Input label="Senha inicial (mínimo 12 caracteres)" type="password" minLength={12} required value={memberForm.password} onChange={(event) => setMemberForm({ ...memberForm, password: event.target.value })} />
            <label className="block text-xs font-semibold text-[#64748b]">Permissão
              <select value={memberForm.companyPermission} onChange={(event) => setMemberForm({ ...memberForm, companyPermission: event.target.value as NonNullable<ApiUser["companyPermission"]> })} className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm">
                <option value="ADMIN">Administrador</option><option value="STANDARD">Padrão</option><option value="RESTRICTED">Restrito</option>
              </select>
            </label>
            <div className="flex items-end"><button disabled={saving} className={buttonClass}>Criar usuário</button></div>
            <p className="text-xs text-[#718096] md:col-span-2">Compartilhe a senha inicial por canal seguro. O usuário poderá alterá-la na própria conta.</p>
          </form>}
          <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white"><table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b8ba1]"><tr>{["Nome", "E-mail", "Permissão", "Status", "Ações"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody>{organization?.members.map((item) => <tr key={item.id} className="border-t border-[#f1f4f8]"><td className="px-4 py-3 font-semibold text-[#102b55]">{item.name}{item.id === user.id && <small className="ml-2 text-[#8795a8]">Você</small>}</td><td className="px-4 py-3">{item.email}</td><td className="px-4 py-3">{item.companyPermission === "ADMIN" ? "Administrador" : item.companyPermission === "RESTRICTED" ? "Restrito" : "Padrão"}</td><td className="px-4 py-3">{item.isActive ? "Ativo" : "Inativo"}</td><td className="px-4 py-3">{canManage && item.id !== user.id && <div className="flex gap-2"><select disabled={saving || !item.isActive} value={item.companyPermission ?? "STANDARD"} aria-label={`Permissão de ${item.name}`} onChange={(event) => void run(() => updateCompanyMember(token, item.id, { companyPermission: event.target.value as NonNullable<ApiUser["companyPermission"]> }), "Permissão atualizada.")} className="rounded-lg border border-[#e8edf4] px-2 py-1"><option value="ADMIN">Administrador</option><option value="STANDARD">Padrão</option><option value="RESTRICTED">Restrito</option></select><button disabled={saving} onClick={() => void run(() => updateCompanyMember(token, item.id, { isActive: !item.isActive }), item.isActive ? "Usuário desativado." : "Usuário ativado.")} className="rounded-lg border border-[#e8edf4] px-2 py-1 font-semibold">{item.isActive ? "Desativar" : "Ativar"}</button></div>}</td></tr>)}</tbody>
          </table>{!organization?.members.length && <p className="p-8 text-center text-sm text-[#718096]">Nenhum usuário cadastrado.</p>}</div>
        </>
      )}

      {tab === "branches" && (
        <>
          {!canManage && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Você tem acesso de consulta. Um administrador da empresa pode gerenciar filiais.</p>}
          {showForm && canManage && <form onSubmit={submitBranch} className={formClass}>
            <Input label="Nome da filial" required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} />
            <Input label="Telefone" value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} />
            <Input label="Endereço" value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} />
            <div className="flex items-end"><button disabled={saving} className={buttonClass}>Salvar filial</button></div>
          </form>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{organization?.branches.map((branch: ApiBranch) => <article key={branch.id} className="rounded-2xl border border-[#e8edf4] bg-white p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-[#102b55]">{branch.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${branch.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{branch.isActive ? "Ativa" : "Inativa"}</span></div><p className="mt-2 text-xs text-[#718096]">{branch.address?.text || "Endereço não informado"}</p><p className="mt-1 text-xs text-[#718096]">{branch.phone || "Telefone não informado"}</p>{canManage && <button disabled={saving} onClick={() => void run(() => updateCompanyBranch(token, branch.id, { isActive: !branch.isActive }), branch.isActive ? "Filial desativada." : "Filial reativada.")} className="mt-3 rounded-lg border border-[#e8edf4] px-3 py-2 text-xs font-semibold">{branch.isActive ? "Desativar filial" : "Reativar filial"}</button>}</article>)}</div>
          {organization?.branches.length === 0 && <p className="rounded-2xl border border-[#e8edf4] bg-white p-8 text-center text-sm text-[#718096]">Nenhuma filial cadastrada.</p>}
        </>
      )}

      {tab === "cost-centers" && (
        <>
          {!canManage && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Você tem acesso de consulta. Um administrador da empresa pode gerenciar centros de custo.</p>}
          {showForm && canManage && <form onSubmit={submitCostCenter} className={formClass}>
            <Input label="Nome do centro de custo" required value={costCenterForm.name} onChange={(event) => setCostCenterForm({ ...costCenterForm, name: event.target.value })} />
            <Input label="Código (opcional)" value={costCenterForm.code} onChange={(event) => setCostCenterForm({ ...costCenterForm, code: event.target.value })} />
            <div className="flex items-end"><button disabled={saving} className={buttonClass}>Salvar centro de custo</button></div>
          </form>}
          <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white"><table className="w-full min-w-[500px] text-left text-xs">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b8ba1]"><tr>{["Centro de custo", "Código", "Status", "Ações"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody>{organization?.costCenters.map((center: ApiCostCenter) => <tr key={center.id} className="border-t border-[#f1f4f8]"><td className="px-4 py-3 font-semibold text-[#102b55]">{center.name}</td><td className="px-4 py-3">{center.code || "—"}</td><td className="px-4 py-3">{center.isActive ? "Ativo" : "Inativo"}</td><td className="px-4 py-3">{canManage && <button disabled={saving} onClick={() => void run(() => updateCompanyCostCenter(token, center.id, { isActive: !center.isActive }), center.isActive ? "Centro de custo desativado." : "Centro de custo reativado.")} className="rounded-lg border border-[#e8edf4] px-3 py-2 font-semibold">{center.isActive ? "Desativar" : "Reativar"}</button>}</td></tr>)}</tbody>
          </table>{organization?.costCenters.length === 0 && <p className="p-8 text-center text-sm text-[#718096]">Nenhum centro de custo cadastrado.</p>}</div>
        </>
      )}
    </div>
  )
}
