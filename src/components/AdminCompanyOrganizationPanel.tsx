import { useCallback, useEffect, useState, type FormEvent } from "react"

import { Plus, RefreshCw, X } from "lucide-react"

import {
  createAdminCompanyBranch,
  createAdminCompanyCostCenter,
  createAdminCompanyMember,
  getAdminCompanyOrganization,
  updateAdminCompanyBranch,
  updateAdminCompanyCostCenter,
  updateAdminCompanyMember,
  type ApiBranch,
  type ApiOrganization,
  type ApiUser,
} from "../services/api"

type Tab = "users" | "branches" | "cost-centers"

const emptyBranch = () => ({
  name: "",
  phone: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  complemento: "",
})

function Input({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  minLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  minLength?: number
}) {
  return (
    <label className="block text-xs font-semibold text-[#64748b]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
      />
    </label>
  )
}

export default function AdminCompanyOrganizationPanel({
  token,
  companyId,
  companyName,
  onClose,
}: {
  token: string
  companyId: string
  companyName: string
  onClose: () => void
}) {
  const [organization, setOrganization] = useState<ApiOrganization | null>(null)
  const [tab, setTab] = useState<Tab>("users")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    companyPermission: "STANDARD" as NonNullable<ApiUser["companyPermission"]>,
  })
  const [editingMemberId, setEditingMemberId] = useState("")
  const [memberEditForm, setMemberEditForm] = useState({
    name: "",
    email: "",
    phone: "",
  })
  const [branchForm, setBranchForm] = useState(emptyBranch)
  const [costCenterForm, setCostCenterForm] = useState({ name: "", code: "" })
  const [editingBranchId, setEditingBranchId] = useState("")
  const [editingCostCenterId, setEditingCostCenterId] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await getAdminCompanyOrganization(token, companyId)
      setOrganization(result.organization)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a estrutura da empresa.",
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = async (
    operation: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      await operation()
      await refresh()
      setAdding(false)
      setEditingMemberId("")
      setEditingBranchId("")
      setEditingCostCenterId("")
      setNotice(success)
      return true
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar as alterações.",
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  const submitMember = (event: FormEvent) => {
    event.preventDefault()
    void save(
      () => createAdminCompanyMember(token, companyId, memberForm),
      "Usuário vinculado à empresa.",
    ).then((saved) => {
      if (saved) {
        setMemberForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          companyPermission: "STANDARD",
        })
      }
    })
  }

  const submitMemberEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editingMemberId) return
    void save(
      () => updateAdminCompanyMember(token, companyId, editingMemberId, {
        name: memberEditForm.name,
        email: memberEditForm.email,
        phone: memberEditForm.phone.trim() || null,
      }),
      "Dados do usuário atualizados.",
    )
  }

  const editMember = (member: ApiUser) => {
    setAdding(false)
    setEditingMemberId(member.id)
    setMemberEditForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
    })
  }

  const submitBranch = (event: FormEvent) => {
    event.preventDefault()
    const { name, phone, ...address } = branchForm
    const branch = {
      name,
      phone: phone || undefined,
      address: {
        ...address,
        cep: address.cep.replace(/\D/g, "") || undefined,
        complemento: address.complemento || undefined,
      },
    }
    void save(
      () => editingBranchId
        ? updateAdminCompanyBranch(token, companyId, editingBranchId, branch)
        : createAdminCompanyBranch(token, companyId, branch),
      editingBranchId ? "Filial atualizada." : "Filial cadastrada.",
    ).then((saved) => {
      if (saved) setBranchForm(emptyBranch())
    })
  }

  const submitCostCenter = (event: FormEvent) => {
    event.preventDefault()
    void save(
      () => editingCostCenterId
        ? updateAdminCompanyCostCenter(
            token,
            companyId,
            editingCostCenterId,
            costCenterForm,
          )
        : createAdminCompanyCostCenter(token, companyId, costCenterForm),
      editingCostCenterId
        ? "Centro de custo atualizado."
        : "Centro de custo cadastrado.",
    ).then((saved) => {
      if (saved) setCostCenterForm({ name: "", code: "" })
    })
  }

  const editBranch = (branch: ApiBranch) => {
    setEditingBranchId(branch.id)
    setBranchForm({
      name: branch.name,
      phone: branch.phone ?? "",
      rua: branch.address?.rua ?? "",
      numero: branch.address?.numero ?? "",
      bairro: branch.address?.bairro ?? "",
      cidade: branch.address?.cidade ?? "",
      estado: branch.address?.estado ?? "",
      cep: branch.address?.cep ?? "",
      complemento: branch.address?.complemento ?? "",
    })
    setAdding(true)
  }

  const tabs: Array<[Tab, string]> = [
    ["users", "Usuários"],
    ["branches", "Filiais"],
    ["cost-centers", "Centros de Custo"],
  ]
  const activeAdminCount = organization?.members.filter(
    (member) => member.isActive && member.companyPermission === "ADMIN",
  ).length ?? 0

  return (
    <section className="space-y-4 rounded-2xl border border-[#dce5ef] bg-[#f9fbfd] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#f47b20]">
            Administração central
          </p>
          <h3 className="mt-1 text-base font-bold text-[#102b55]">
            Gerenciar {companyName}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Atualizar estrutura"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] disabled:opacity-50"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerenciamento da empresa"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>
      )}
      {loading && <p className="text-xs text-[#718096]">Carregando estrutura…</p>}

      <div className="flex gap-2 overflow-x-auto border-b border-[#e2e8f0]">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id)
              setAdding(false)
              setEditingMemberId("")
            }}
            className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold ${
              tab === id
                ? "border-[#f47b20] text-[#c76216]"
                : "border-transparent text-[#718096]"
            }`}
          >
            {label}
          </button>
        ))}
        {(
          <button
            type="button"
            onClick={() => {
              setAdding((current) => !current)
              setEditingMemberId("")
              setEditingBranchId("")
              setEditingCostCenterId("")
              setMemberForm({
                name: "",
                email: "",
                phone: "",
                password: "",
                companyPermission: "STANDARD",
              })
              setBranchForm(emptyBranch())
              setCostCenterForm({ name: "", code: "" })
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs font-bold text-[#0f3266]"
          >
            <Plus size={14} /> {tab === "users" ? "Adicionar usuário" : "Adicionar"}
          </button>
        )}
      </div>

      {tab === "users" && (
        <div className="space-y-3">
          {adding && !editingMemberId && (
            <form onSubmit={submitMember} className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 md:grid-cols-2">
              <Input label="Nome" value={memberForm.name} required onChange={(name) => setMemberForm({ ...memberForm, name })} />
              <Input label="E-mail" type="email" value={memberForm.email} required onChange={(email) => setMemberForm({ ...memberForm, email })} />
              <Input label="Telefone (opcional)" value={memberForm.phone} onChange={(phone) => setMemberForm({ ...memberForm, phone })} />
              <Input label="Senha inicial (mín. 12 caracteres)" type="password" value={memberForm.password} minLength={12} required onChange={(password) => setMemberForm({ ...memberForm, password })} />
              <label className="block text-xs font-semibold text-[#64748b]">
                Permissão
                <select
                  value={memberForm.companyPermission}
                  onChange={(event) => setMemberForm({
                    ...memberForm,
                    companyPermission: event.target.value as typeof memberForm.companyPermission,
                  })}
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm"
                >
                  <option value="ADMIN">Administrador da empresa</option>
                  <option value="STANDARD">Padrão</option>
                  <option value="RESTRICTED">Restrito</option>
                </select>
              </label>
              <div className="flex items-end">
                <button disabled={saving} className="h-10 rounded-xl bg-[#0c225a] px-4 text-xs font-bold text-white disabled:opacity-50">Criar usuário</button>
              </div>
            </form>
          )}
          {editingMemberId && (
            <form onSubmit={submitMemberEdit} className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 md:grid-cols-2">
              <Input label="Nome" value={memberEditForm.name} required onChange={(name) => setMemberEditForm({ ...memberEditForm, name })} />
              <Input label="E-mail" type="email" value={memberEditForm.email} required onChange={(email) => setMemberEditForm({ ...memberEditForm, email })} />
              <Input label="Telefone (opcional)" value={memberEditForm.phone} onChange={(phone) => setMemberEditForm({ ...memberEditForm, phone })} />
              <div className="flex items-end gap-2">
                <button disabled={saving} className="h-10 rounded-xl bg-[#0c225a] px-4 text-xs font-bold text-white disabled:opacity-50">Salvar usuário</button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingMemberId("")}
                  className="h-10 rounded-xl border border-[#e2e8f0] px-4 text-xs font-bold text-[#64748b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-white text-[10px] uppercase tracking-wide text-[#7b8ba1]">
                <tr>{["Nome", "E-mail", "Permissão", "Status", "Ações"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody>
                {organization?.members.map((member) => (
                  <tr key={member.id} className="border-t border-[#f1f4f8]">
                    <td className="px-4 py-3 font-semibold text-[#102b55]">{member.name}</td>
                    <td className="px-4 py-3">{member.email}</td>
                    <td className="px-4 py-3">
                      <select
                        disabled={saving || !member.isActive}
                        value={member.companyPermission ?? "STANDARD"}
                        aria-label={`Permissão de ${member.name}`}
                        onChange={(event) => void save(
                          () => updateAdminCompanyMember(token, companyId, member.id, {
                            companyPermission: event.target.value as NonNullable<ApiUser["companyPermission"]>,
                          }),
                          "Permissão atualizada.",
                        )}
                        className="rounded-lg border border-[#e8edf4] px-2 py-1"
                      >
                        <option value="ADMIN">Administrador da empresa</option>
                        <option value="STANDARD">Padrão</option>
                        <option value="RESTRICTED">Restrito</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{member.isActive ? "Ativo" : "Inativo"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => editMember(member)}
                          className="rounded-lg border border-[#e8edf4] px-2 py-1 font-semibold disabled:opacity-40"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={saving || (
                            member.isActive &&
                            member.companyPermission === "ADMIN" &&
                            activeAdminCount <= 1
                          )}
                          onClick={() => void save(
                            () => updateAdminCompanyMember(token, companyId, member.id, { isActive: !member.isActive }),
                            member.isActive ? "Usuário desativado." : "Usuário ativado.",
                          )}
                          className="rounded-lg border border-[#e8edf4] px-2 py-1 font-semibold disabled:opacity-40"
                        >
                          {member.isActive ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {organization?.members.length === 0 && <p className="p-6 text-center text-sm text-[#718096]">Nenhum usuário cadastrado.</p>}
          </div>
        </div>
      )}

      {tab === "branches" && (
        <div className="space-y-3">
          {adding && (
            <form onSubmit={submitBranch} className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 md:grid-cols-2">
              <Input label="Nome da filial" value={branchForm.name} required onChange={(name) => setBranchForm({ ...branchForm, name })} />
              <Input label="Telefone" value={branchForm.phone} onChange={(phone) => setBranchForm({ ...branchForm, phone })} />
              <Input label="Rua / Avenida" value={branchForm.rua} required onChange={(rua) => setBranchForm({ ...branchForm, rua })} />
              <Input label="Número" value={branchForm.numero} required onChange={(numero) => setBranchForm({ ...branchForm, numero })} />
              <Input label="Bairro" value={branchForm.bairro} required onChange={(bairro) => setBranchForm({ ...branchForm, bairro })} />
              <Input label="Cidade" value={branchForm.cidade} required onChange={(cidade) => setBranchForm({ ...branchForm, cidade })} />
              <Input label="Estado" value={branchForm.estado} required onChange={(estado) => setBranchForm({ ...branchForm, estado: estado.toUpperCase().slice(0, 2) })} />
              <Input label="CEP" value={branchForm.cep} onChange={(cep) => setBranchForm({ ...branchForm, cep: cep.replace(/\D/g, "").slice(0, 8) })} />
              <Input label="Complemento" value={branchForm.complemento} onChange={(complemento) => setBranchForm({ ...branchForm, complemento })} />
              <div className="flex items-end">
                <button disabled={saving} className="h-10 rounded-xl bg-[#0c225a] px-4 text-xs font-bold text-white disabled:opacity-50">{editingBranchId ? "Salvar filial" : "Cadastrar filial"}</button>
              </div>
            </form>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organization?.branches.map((branch) => (
              <article key={branch.id} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-[#102b55]">{branch.name}</h4>
                  <span className="text-[10px] font-bold text-[#64748b]">{branch.isActive ? "Ativa" : "Inativa"}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#52657f]">{branch.address?.text || [branch.address?.rua && `${branch.address.rua}, ${branch.address.numero}`, branch.address?.complemento, branch.address?.bairro, [branch.address?.cidade, branch.address?.estado].filter(Boolean).join(" - "), branch.address?.cep && `CEP ${branch.address.cep}`].filter(Boolean).join(", ") || "Endereço não informado"}</p>
                <p className="mt-1 text-xs text-[#718096]">{branch.phone || "Telefone não informado"}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => editBranch(branch)} className="rounded-lg border border-[#e8edf4] px-3 py-2 text-xs font-semibold">Editar</button>
                  <button type="button" disabled={saving} onClick={() => void save(
                    () => updateAdminCompanyBranch(token, companyId, branch.id, { isActive: !branch.isActive }),
                    branch.isActive ? "Filial desativada." : "Filial ativada.",
                  )} className="rounded-lg border border-[#e8edf4] px-3 py-2 text-xs font-semibold">{branch.isActive ? "Desativar" : "Ativar"}</button>
                </div>
              </article>
            ))}
          </div>
          {organization?.branches.length === 0 && <p className="rounded-xl border border-[#e2e8f0] bg-white p-6 text-center text-sm text-[#718096]">Nenhuma filial cadastrada.</p>}
        </div>
      )}

      {tab === "cost-centers" && (
        <div className="space-y-3">
          {adding && (
            <form onSubmit={submitCostCenter} className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
              <Input label="Nome do centro de custo" value={costCenterForm.name} required onChange={(name) => setCostCenterForm({ ...costCenterForm, name })} />
              <Input label="Código (opcional)" value={costCenterForm.code} onChange={(code) => setCostCenterForm({ ...costCenterForm, code })} />
              <button disabled={saving} className="h-10 self-end rounded-xl bg-[#0c225a] px-4 text-xs font-bold text-white disabled:opacity-50">{editingCostCenterId ? "Salvar" : "Cadastrar"}</button>
            </form>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organization?.costCenters.map((center) => (
              <article key={center.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
                <div className="min-w-0">
                  <h4 className="truncate font-bold text-[#102b55]">{center.name}</h4>
                  <p className="mt-1 text-xs text-[#718096]">{center.code || "Sem código"} · {center.isActive ? "Ativo" : "Inativo"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => {
                    setEditingCostCenterId(center.id)
                    setCostCenterForm({ name: center.name, code: center.code ?? "" })
                    setAdding(true)
                  }} className="rounded-lg border border-[#e8edf4] px-2.5 py-2 text-xs font-semibold">Editar</button>
                  <button type="button" disabled={saving} onClick={() => void save(
                    () => updateAdminCompanyCostCenter(token, companyId, center.id, { isActive: !center.isActive }),
                    center.isActive ? "Centro de custo desativado." : "Centro de custo ativado.",
                  )} className="rounded-lg border border-[#e8edf4] px-2.5 py-2 text-xs font-semibold">{center.isActive ? "Desativar" : "Ativar"}</button>
                </div>
              </article>
            ))}
          </div>
          {organization?.costCenters.length === 0 && <p className="rounded-xl border border-[#e2e8f0] bg-white p-6 text-center text-sm text-[#718096]">Nenhum centro de custo cadastrado.</p>}
        </div>
      )}
    </section>
  )
}
