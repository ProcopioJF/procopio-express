import { useCallback, useEffect, useState } from "react"

import { Building2, RefreshCw, Users } from "lucide-react"

import {
  getCompanyOrganization,
  type ApiCompanySettings,
  type ApiOrganization,
  type ApiUser,
} from "../services/api"

type Tab = "company" | "users" | "branches"

function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8795a8]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[#102b55]">
        {value?.trim() || "Não informado"}
      </p>
    </div>
  )
}

function branchAddress(branch: ApiOrganization["branches"][number]) {
  const address = branch.address
  if (!address) return "Endereço não informado"
  if (address.text?.trim()) return address.text
  return [
    [address.rua, address.numero].filter(Boolean).join(", "),
    address.complemento,
    address.bairro,
    [address.cidade, address.estado].filter(Boolean).join(" - "),
    address.cep ? `CEP ${address.cep}` : "",
  ]
    .filter(Boolean)
    .join(", ") || "Endereço não informado"
}

export default function CompanyOrganizationPanel({
  token,
  user,
  profile,
  onFeedback,
}: {
  token: string
  user: ApiUser
  profile: ApiCompanySettings
  onFeedback: (error: string, notice?: string) => void
}) {
  const [tab, setTab] = useState<Tab>("company")
  const [organization, setOrganization] = useState<ApiOrganization | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCompanyOrganization(token)
      setOrganization(result.organization)
    } catch (cause) {
      onFeedback(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados da empresa.",
      )
    } finally {
      setLoading(false)
    }
  }, [onFeedback, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const tabs: Array<[Tab, string]> = [
    ["company", "Dados da Empresa"],
    ["users", "Usuários"],
    ["branches", "Filiais"],
  ]
  const company = organization?.company

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#102b55]">
            Perfil da Empresa
          </h2>
          <p className="mt-1 text-xs text-[#718096]">
            Consulte os dados vinculados à sua organização.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Atualizar dados da empresa"
          className="grid h-9 w-9 place-items-center rounded-xl border border-[#e8edf4] bg-white text-[#718096] disabled:opacity-50"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto border-b border-[#e8edf4]">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${
              tab === id
                ? "border-[#f47b20] text-[#c76216]"
                : "border-transparent text-[#718096]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-xs text-[#718096]">Carregando dados da empresa…</p>
      )}

      {tab === "company" && (
        <section className="rounded-2xl border border-[#e8edf4] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff3e9] text-[#e97820]">
              <Building2 size={19} />
            </span>
            <div>
              <h3 className="font-bold text-[#102b55]">
                {company?.name || profile.name || user.name}
              </h3>
              <p className="text-xs text-[#8795a8]">
                Informações cadastradas no Procópio Express
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Nome da empresa" value={company?.name || profile.name} />
            {company?.document && (
              <InfoCard label="CNPJ ou documento" value={company.document} />
            )}
            <InfoCard label="Telefone" value={company?.phone || profile.phone} />
            <InfoCard label="E-mail" value={company?.email || profile.email} />
            <div className="sm:col-span-2">
              <InfoCard
                label="Endereço"
                value={company?.address || profile.address}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-[#718096]">
            Para solicitar alterações cadastrais, entre em contato com a
            administração do Procópio Express.
          </p>
        </section>
      )}

      {tab === "users" && (
        <section className="overflow-hidden rounded-2xl border border-[#e8edf4] bg-white">
          <div className="flex items-center gap-2 border-b border-[#eef2f6] p-4">
            <Users size={16} className="text-[#e97820]" />
            <div>
              <h3 className="text-sm font-bold text-[#102b55]">Usuários</h3>
              <p className="mt-0.5 text-xs text-[#8795a8]">
                Contas vinculadas à organização.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b8ba1]">
                <tr>
                  {["Nome", "E-mail", "Permissão", "Status"].map((label) => (
                    <th key={label} className="px-4 py-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organization?.members.map((member) => (
                  <tr key={member.id} className="border-t border-[#f1f4f8]">
                    <td className="px-4 py-3 font-semibold text-[#102b55]">
                      {member.name}
                      {member.id === user.id && (
                        <span className="ml-2 text-[#8795a8]">Você</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#52657f]">{member.email}</td>
                    <td className="px-4 py-3 text-[#52657f]">
                      {member.companyPermission === "ADMIN"
                        ? "Administrador da empresa"
                        : member.companyPermission === "RESTRICTED"
                          ? "Restrito"
                          : "Padrão"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        member.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {member.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {organization?.members.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                Nenhum usuário vinculado à empresa.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "branches" && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#102b55]">
            Filiais e endereços cadastrados
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organization?.branches.map((branch) => (
              <article
                key={branch.id}
                className="rounded-2xl border border-[#e8edf4] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-bold text-[#102b55]">{branch.name}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    branch.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {branch.isActive ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#52657f]">
                  {branchAddress(branch)}
                </p>
                <p className="mt-2 text-xs text-[#718096]">
                  Telefone: {branch.phone || "Não informado"}
                </p>
              </article>
            ))}
          </div>
          {organization?.branches.length === 0 && (
            <p className="rounded-2xl border border-[#e8edf4] bg-white p-8 text-center text-sm text-[#718096]">
              Nenhuma filial cadastrada.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
