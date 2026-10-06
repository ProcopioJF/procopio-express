import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

import type { InputHTMLAttributes } from "react"

import { Activity, Copy, KeyRound, Pencil, Plus, RefreshCw, ShieldCheck } from "lucide-react"

import {
  createAdminFinancialEntry,
  createAdminSubscription,
  createAdminSystemUser,
  getAdminAuditLogs,
  getAdminFinancialEntries,
  getAdminFinancialSummary,
  getAdminIntegrations,
  getAdminLeads,
  getAdminPlans,
  getAdminSubscriptions,
  getAdminSystemUsers,
  resetAdminSystemUserPassword,
  saveAdminLead,
  saveAdminPlan,
  updateAdminPlan,
  updateAdminSubscription,
  updateAdminSystemUser,
  type ApiAuditLog,
  type ApiCompany,
  type ApiFinancialEntry,
  type ApiFinancialMonth,
  type ApiIntegration,
  type ApiLead,
  type ApiPlan,
  type ApiSubscription,
  type ApiSystemUser,
} from "../services/api"

type Mode = "commercial" | "finance" | "users" | "audit" | "integrations"

type CommercialTab = "leads" | "contracts" | "plans"

const FinancialChart = lazy(() => import("./FinancialChart"))

const LEAD_STAGES: Array<{ id: ApiLead["stage"]; label: string }> = [
  { id: "LEAD", label: "Lead" },

  { id: "QUALIFIED", label: "Qualificado" },

  { id: "PROPOSAL", label: "Proposta" },

  { id: "CLOSED_WON", label: "Fechado" },

  { id: "CLOSED_LOST", label: "Perdido" },
]

const money = (value: number | string) =>
  `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")

const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—"

const calendarDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(value),
      )
    : "—"

const EMPTY_LEAD_FORM = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  source: "",
  estimatedMonthlyRevenue: "",
  notes: "",
  followUpAt: "",
}

const EMPTY_PLAN_FORM = {
  name: "",
  description: "",
  monthlyPrice: "",
  annualPrice: "",
  monthlyOrderLimit: "",
}

const FINANCIAL_ENTRY_PAGE_SIZE = 100

const brazilMonthKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",

    year: "numeric",

    month: "2-digit",
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value

  const month = parts.find((part) => part.type === "month")?.value

  if (!year || !month)
    throw new Error("Não foi possível determinar o mês de referência.")

  return `${year}-${month}`
}

function PageTitle({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[#102b55]">{title}</h2>
      <p className="mt-1 text-xs text-[#8795a8]">{description}</p>
    </div>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="rounded-2xl border border-[#e8edf4] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7b8ba1]">
        {label}
      </p>
      <strong className="mt-2 block text-xl font-extrabold text-[#102b55]">
        {value}
      </strong>
      <p className="mt-1 text-xs text-[#8795a8]">{detail}</p>
    </article>
  )
}

function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-xs font-semibold text-[#64748b]">
      {label}
      <input
        {...props}
        className={`mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55] outline-none focus:border-[#f47b20] ${props.className ?? ""}`}
      />
    </label>
  )
}

export default function AdminBusinessPanel({
  token,

  mode,

  companies = [],
}: {
  token: string

  mode: Mode

  companies?: ApiCompany[]
}) {
  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const [commercialTab, setCommercialTab] = useState<CommercialTab>("leads")

  const [showForm, setShowForm] = useState(false)

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)

  const [leads, setLeads] = useState<ApiLead[]>([])

  const [plans, setPlans] = useState<ApiPlan[]>([])

  const [subscriptions, setSubscriptions] = useState<ApiSubscription[]>([])

  const [subscriptionSearch, setSubscriptionSearch] = useState("")

  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "ALL" | ApiSubscription["status"]
  >("ALL")

  const [editingSubscriptionId, setEditingSubscriptionId] = useState<
    string | null
  >(null)

  const [subscriptionEditForm, setSubscriptionEditForm] = useState({
    monthlyPrice: "",
    renewalAt: "",
  })

  const [entries, setEntries] = useState<ApiFinancialEntry[]>([])

  const [entryTotal, setEntryTotal] = useState(0)

  const [loadingMoreEntries, setLoadingMoreEntries] = useState(false)

  const [entrySearch, setEntrySearch] = useState("")

  const [entryTypeFilter, setEntryTypeFilter] = useState<
    "ALL" | ApiFinancialEntry["type"]
  >("ALL")

  const [entryFrom, setEntryFrom] = useState("")

  const [entryTo, setEntryTo] = useState("")

  const [appliedEntryFilters, setAppliedEntryFilters] = useState<{
    search: string
    type?: ApiFinancialEntry["type"]
    from?: string
    to?: string
  }>({ search: "" })

  const [financialMonths, setFinancialMonths] = useState<ApiFinancialMonth[]>(
    [],
  )

  const [users, setUsers] = useState<ApiSystemUser[]>([])

  const [userSearch, setUserSearch] = useState("")

  const [userStatusFilter, setUserStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL")

  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(
    null,
  )

  const [temporaryPassword, setTemporaryPassword] = useState<{
    userId: string
    password: string
  } | null>(null)

  const [logs, setLogs] = useState<ApiAuditLog[]>([])

  const [auditSearch, setAuditSearch] = useState("")

  const [auditActionFilter, setAuditActionFilter] = useState("ALL")

  const [auditEntityFilter, setAuditEntityFilter] = useState("ALL")

  const [integrations, setIntegrations] = useState<ApiIntegration[]>([])

  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM)

  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM)

  const [subscriptionForm, setSubscriptionForm] = useState({
    companyId: "",
    planId: "",
    renewalAt: "",
  })

  const [entryForm, setEntryForm] = useState({
    type: "INCOME" as ApiFinancialEntry["type"],
    description: "",
    category: "",
    amount: "",
    companyId: "",
  })

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "ADMIN" as ApiSystemUser["role"],
  })

  const refresh = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      if (mode === "commercial") {
        const [leadResult, planResult, subscriptionResult] = await Promise.all([
          getAdminLeads(token),

          getAdminPlans(token),

          getAdminSubscriptions(token),
        ])

        setLeads(leadResult.leads)

        setPlans(planResult.plans)

        setSubscriptions(subscriptionResult.subscriptions)
      } else if (mode === "finance") {
        const [entryResult, subscriptionResult, financialSummary] =
          await Promise.all([
            getAdminFinancialEntries(token, {
              offset: 0,
              limit: FINANCIAL_ENTRY_PAGE_SIZE,
              ...appliedEntryFilters,
            }),

            getAdminSubscriptions(token),

            getAdminFinancialSummary(token),
          ])

        setEntries(entryResult.entries)

        setEntryTotal(entryResult.total)

        setSubscriptions(subscriptionResult.subscriptions)

        setFinancialMonths(financialSummary.months)
      } else if (mode === "users") {
        setUsers((await getAdminSystemUsers(token)).users)
      } else if (mode === "audit") {
        setLogs((await getAdminAuditLogs(token)).logs)
      } else {
        setIntegrations((await getAdminIntegrations(token)).integrations)
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados.",
      )
    } finally {
      setLoading(false)
    }
  }, [appliedEntryFilters, mode, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMoreEntries = async () => {
    if (loadingMoreEntries || entries.length >= entryTotal) return

    setLoadingMoreEntries(true)
    setError("")

    try {
      const result = await getAdminFinancialEntries(token, {
        offset: entries.length,
        limit: FINANCIAL_ENTRY_PAGE_SIZE,
        ...appliedEntryFilters,
      })
      setEntries((currentEntries) => [...currentEntries, ...result.entries])
      setEntryTotal(result.total)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar mais lançamentos.",
      )
    } finally {
      setLoadingMoreEntries(false)
    }
  }

  const applyEntryFilters = (event: FormEvent) => {
    event.preventDefault()
    setAppliedEntryFilters({
      search: entrySearch.trim(),
      ...(entryTypeFilter !== "ALL" ? { type: entryTypeFilter } : {}),
      ...(entryFrom ? { from: entryFrom } : {}),
      ...(entryTo ? { to: entryTo } : {}),
    })
  }

  const runSave = async (
    operation: () => Promise<unknown>,
    success: string,
  ) => {
    setSaving(true)

    setError("")

    setNotice("")

    try {
      await operation()

      await refresh()

      setNotice(success)

      setShowForm(false)
      return true
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  const submitLead = (event: FormEvent) => {
    event.preventDefault()

    void runSave(
      () =>
        saveAdminLead(
          token,
          {
            companyName: leadForm.companyName,

            contactName: leadForm.contactName,

            email: leadForm.email || null,

            phone: leadForm.phone || null,

            city: leadForm.city || null,

            source: leadForm.source || null,

            estimatedMonthlyRevenue: leadForm.estimatedMonthlyRevenue
              ? Number(leadForm.estimatedMonthlyRevenue)
              : null,
            notes: leadForm.notes || null,
            followUpAt: leadForm.followUpAt
              ? `${leadForm.followUpAt}T00:00:00.000Z`
              : null,
          },
          editingLeadId ?? undefined,
        ),

      editingLeadId ? "Lead atualizado." : "Lead cadastrado.",
    )
  }

  const editLead = (lead: ApiLead) => {
    setLeadForm({
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      city: lead.city ?? "",
      source: lead.source ?? "",
      estimatedMonthlyRevenue:
        lead.estimatedMonthlyRevenue == null
          ? ""
          : String(lead.estimatedMonthlyRevenue),
      notes: lead.notes ?? "",
      followUpAt: lead.followUpAt?.slice(0, 10) ?? "",
    })
    setEditingLeadId(lead.id)
    setShowForm(true)
  }

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false)
      setEditingLeadId(null)
      setEditingPlanId(null)
      if (mode === "commercial" && commercialTab === "leads") {
        setLeadForm(EMPTY_LEAD_FORM)
      }
      if (mode === "commercial" && commercialTab === "plans") {
        setPlanForm(EMPTY_PLAN_FORM)
      }
      return
    }
    if (mode === "commercial" && commercialTab === "leads") {
      setEditingLeadId(null)
      setLeadForm(EMPTY_LEAD_FORM)
    }
    if (mode === "commercial" && commercialTab === "plans") {
      setEditingPlanId(null)
      setPlanForm(EMPTY_PLAN_FORM)
    }
    setShowForm(true)
  }

  const editPlan = (plan: ApiPlan) => {
    setPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      monthlyPrice: String(plan.monthlyPrice),
      annualPrice: String(plan.annualPrice),
      monthlyOrderLimit:
        plan.monthlyOrderLimit == null ? "" : String(plan.monthlyOrderLimit),
    })
    setEditingPlanId(plan.id)
    setShowForm(true)
  }

  const submitPlan = (event: FormEvent) => {
    event.preventDefault()

    const planData = {
      name: planForm.name,
      description: planForm.description || null,
      monthlyPrice: Number(planForm.monthlyPrice),
      annualPrice: Number(planForm.annualPrice),
      monthlyOrderLimit: planForm.monthlyOrderLimit
        ? Number(planForm.monthlyOrderLimit)
        : null,
    }

    void runSave(
      () =>
        editingPlanId
          ? updateAdminPlan(token, editingPlanId, planData)
          : saveAdminPlan(token, planData),

      editingPlanId ? "Plano atualizado." : "Plano cadastrado.",
    )
  }

  const submitSubscription = (event: FormEvent) => {
    event.preventDefault()

    void runSave(
      () =>
        createAdminSubscription(token, {
          ...subscriptionForm,

          status: "ACTIVE",

          renewalAt: subscriptionForm.renewalAt || null,
        }),

      "Contrato cadastrado. A assinatura anterior, se ativa, foi encerrada.",
    )
  }

  const editSubscription = (subscription: ApiSubscription) => {
    setSubscriptionEditForm({
      monthlyPrice: String(subscription.monthlyPrice),
      renewalAt: subscription.renewalAt?.slice(0, 10) ?? "",
    })
    setEditingSubscriptionId(subscription.id)
  }

  const submitSubscriptionUpdate = (event: FormEvent) => {
    event.preventDefault()
    if (!editingSubscriptionId) return

    void runSave(
      () =>
        updateAdminSubscription(token, editingSubscriptionId, {
          monthlyPrice: Number(subscriptionEditForm.monthlyPrice),
          renewalAt: subscriptionEditForm.renewalAt
            ? `${subscriptionEditForm.renewalAt}T00:00:00.000Z`
            : null,
        }),
      "Condições do contrato atualizadas.",
    ).then((saved) => {
      if (saved) setEditingSubscriptionId(null)
    })
  }

  const submitEntry = (event: FormEvent) => {
    event.preventDefault()

    void runSave(
      () =>
        createAdminFinancialEntry(token, {
          ...entryForm,

          companyId: entryForm.companyId || null,

          amount: Number(entryForm.amount),

          occurredAt: new Date().toISOString(),
        }),

      "Lançamento financeiro registrado.",
    )
  }

  const submitUser = (event: FormEvent) => {
    event.preventDefault()

    const role = userForm.role
    void runSave(
      () => createAdminSystemUser(token, userForm),
      `${role === "COURIER" ? "Motoboy" : role === "COMPANY" ? "Conta empresarial" : "Administrador"} criado.`,
    ).then((created) => {
      if (created) {
        setUserForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "ADMIN",
        })
      }
    })
  }

  const createTemporaryPassword = () => {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_"
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
  }

  const resetUserPassword = async (user: ApiSystemUser) => {
    const password = createTemporaryPassword()
    setSaving(true)
    setError("")
    setNotice("")
    setTemporaryPassword(null)

    try {
      await resetAdminSystemUserPassword(token, user.id, password)
      setTemporaryPassword({ userId: user.id, password })
      setPasswordResetUserId(user.id)
      await refresh()
      setNotice(
        `Senha temporária de ${user.name} criada. Compartilhe-a por um canal seguro.`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível redefinir a senha.",
      )
    } finally {
      setSaving(false)
    }
  }

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return

    try {
      await navigator.clipboard.writeText(temporaryPassword.password)
      setNotice("Senha temporária copiada. Compartilhe-a por canal seguro.")
    } catch {
      setError("Não foi possível copiar. Selecione e copie a senha exibida.")
    }
  }

  const chartMonths = useMemo(() => {
    const current = brazilMonthKey(new Date())

    const [currentYear, currentMonth] = current.split("-").map(Number)

    const byMonth = new Map(financialMonths.map((item) => [item.month, item]))

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(currentYear, currentMonth - 6 + index, 1))

      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`

      return {
        month: key,

        label: new Intl.DateTimeFormat("pt-BR", {
          month: "short",
          timeZone: "UTC",
        })
          .format(date)
          .replace(".", ""),

        income: byMonth.get(key)?.income ?? 0,

        expenses: byMonth.get(key)?.expenses ?? 0,
      }
    })
  }, [financialMonths])

  const currentMonthSummary = chartMonths[chartMonths.length - 1]

  const currentMonthIncome = currentMonthSummary?.income ?? 0

  const currentMonthExpenses = currentMonthSummary?.expenses ?? 0

  const monthlyRecurringRevenue = subscriptions
    .filter((item) => item.status === "ACTIVE")
    .reduce((sum, item) => sum + Number(item.monthlyPrice), 0)

  const filteredSubscriptions = useMemo(() => {
    const query = normalizeSearchText(subscriptionSearch.trim())

    return subscriptions.filter((item) => {
      const matchesStatus =
        subscriptionStatusFilter === "ALL" ||
        item.status === subscriptionStatusFilter
      const matchesSearch =
        !query ||
        normalizeSearchText(`${item.company?.name ?? ""} ${item.plan.name}`)
          .includes(query)

      return matchesStatus && matchesSearch
    })
  }, [subscriptionSearch, subscriptionStatusFilter, subscriptions])

  const auditActions = useMemo(
    () => [...new Set(logs.map((log) => log.action))].sort(),
    [logs],
  )

  const auditEntities = useMemo(
    () => [...new Set(logs.map((log) => log.entity))].sort(),
    [logs],
  )

  const filteredLogs = useMemo(() => {
    const query = normalizeSearchText(auditSearch.trim())

    return logs.filter((log) => {
      const matchesAction =
        auditActionFilter === "ALL" || log.action === auditActionFilter
      const matchesEntity =
        auditEntityFilter === "ALL" || log.entity === auditEntityFilter
      const matchesSearch =
        !query ||
        normalizeSearchText(
          `${log.actorName} ${log.action} ${log.entity} ${log.entityId ?? ""} ${JSON.stringify(log.details ?? "")}`,
        ).includes(query)

      return matchesAction && matchesEntity && matchesSearch
    })
  }, [auditActionFilter, auditEntityFilter, auditSearch, logs])

  const filteredUsers = useMemo(() => {
    const query = normalizeSearchText(userSearch.trim())

    return users.filter((user) => {
      const matchesStatus =
        userStatusFilter === "ALL" ||
        (userStatusFilter === "ACTIVE" ? user.isActive : !user.isActive)
      const matchesSearch =
        !query || normalizeSearchText(`${user.name} ${user.email}`).includes(query)

      return matchesStatus && matchesSearch
    })
  }, [userSearch, userStatusFilter, users])

  const overdueValue = subscriptions
    .filter((item) => item.status === "OVERDUE")
    .reduce((sum, item) => sum + Number(item.monthlyPrice), 0)

  const formClass =
    "grid gap-3 rounded-2xl border border-[#e8edf4] bg-white p-4 md:grid-cols-2 xl:grid-cols-3"

  const actionClass =
    "flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f47b20] px-4 text-xs font-bold text-white disabled:opacity-50"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {mode === "commercial" && (
            <PageTitle
              title="Gestão comercial"
              description="Pipeline de oportunidades, planos e contratos persistidos."
            />
          )}
          {mode === "finance" && (
            <PageTitle
              title="Financeiro empresarial"
              description="Receitas e despesas lançadas, mais recorrência contratada — sem valores de demonstração."
            />
          )}
          {mode === "users" && (
            <PageTitle
              title="Usuários do sistema"
              description="Contas de administradores, motoboys e empresas; senhas nunca são retornadas pela API."
            />
          )}
          {mode === "audit" && (
            <PageTitle
              title="Logs & auditoria"
              description="Eventos registrados nas operações administrativas e empresariais."
            />
          )}
          {mode === "integrations" && (
            <PageTitle
              title="Integrações"
              description="Status calculado pela configuração e pelos recursos realmente disponíveis no servidor."
            />
          )}
        </div>
        <div className="flex gap-2">
          {((mode === "commercial" &&
            (commercialTab === "leads" ||
              commercialTab === "contracts" ||
              commercialTab === "plans")) ||
            mode === "finance" ||
            mode === "users") && (
            <button
              onClick={toggleForm}
              className="flex h-9 items-center gap-2 rounded-xl bg-[#f47b20] px-3 text-xs font-bold text-white"
            >
              <Plus size={14} /> Adicionar
            </button>
          )}
          <button
            onClick={() => void refresh()}
            aria-label="Atualizar"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e8edf4] bg-white text-[#718096]"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}
      {loading && (
        <p className="text-xs text-[#718096]">Carregando informações...</p>
      )}

      {mode === "commercial" && (
        <>
          <div className="flex flex-nowrap gap-2 overflow-x-auto border-b border-[#e8edf4]">
            {([
              ["leads", "Pipeline CRM"],
              ["contracts", "Contratos e assinaturas"],
              ["plans", "Planos"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setCommercialTab(id)
                  setShowForm(false)
                  setEditingLeadId(null)
                  setEditingPlanId(null)
                }}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${
                  commercialTab === id
                    ? "border-[#f47b20] text-[#c76216]"
                    : "border-transparent text-[#718096]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {showForm && commercialTab === "leads" && (
            <form onSubmit={submitLead} className={formClass}>
              <Input
                label="Empresa"
                required
                value={leadForm.companyName}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, companyName: event.target.value })
                }
              />
              <Input
                label="Pessoa de contato"
                required
                value={leadForm.contactName}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, contactName: event.target.value })
                }
              />
              <Input
                label="E-mail"
                type="email"
                value={leadForm.email}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, email: event.target.value })
                }
              />
              <Input
                label="Telefone"
                value={leadForm.phone}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, phone: event.target.value })
                }
              />
              <Input
                label="Cidade"
                value={leadForm.city}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, city: event.target.value })
                }
              />
              <Input
                label="Origem"
                value={leadForm.source}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, source: event.target.value })
                }
              />
              <Input
                label="Receita mensal estimada (R$)"
                type="number"
                min="0"
                step="0.01"
                value={leadForm.estimatedMonthlyRevenue}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    estimatedMonthlyRevenue: event.target.value,
                  })
                }
              />
              <Input
                label="Próximo contato"
                type="date"
                value={leadForm.followUpAt}
                onChange={(event) =>
                  setLeadForm({ ...leadForm, followUpAt: event.target.value })
                }
              />
              <label className="block text-xs font-semibold text-[#64748b] md:col-span-2">
                Observações
                <textarea
                  value={leadForm.notes}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, notes: event.target.value })
                  }
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-normal text-[#102b55] outline-none focus:border-[#f47b20]"
                />
              </label>
              <div className="flex items-end">
                <button className={actionClass} disabled={saving}>
                  {editingLeadId ? "Salvar alterações" : "Salvar lead"}
                </button>
              </div>
            </form>
          )}
          {showForm && commercialTab === "plans" && (
            <form onSubmit={submitPlan} className={formClass}>
              <Input
                label="Nome do plano"
                required
                value={planForm.name}
                onChange={(event) =>
                  setPlanForm({ ...planForm, name: event.target.value })
                }
              />
              <Input
                label="Mensalidade (R$)"
                type="number"
                min="0"
                step="0.01"
                required
                value={planForm.monthlyPrice}
                onChange={(event) =>
                  setPlanForm({ ...planForm, monthlyPrice: event.target.value })
                }
              />
              <Input
                label="Valor anual (R$)"
                type="number"
                min="0"
                step="0.01"
                required
                value={planForm.annualPrice}
                onChange={(event) =>
                  setPlanForm({ ...planForm, annualPrice: event.target.value })
                }
              />
              <Input
                label="Limite mensal de pedidos (opcional)"
                type="number"
                min="1"
                value={planForm.monthlyOrderLimit}
                onChange={(event) =>
                  setPlanForm({
                    ...planForm,
                    monthlyOrderLimit: event.target.value,
                  })
                }
              />
              <Input
                label="Descrição"
                value={planForm.description}
                onChange={(event) =>
                  setPlanForm({ ...planForm, description: event.target.value })
                }
              />
              <div className="flex items-end">
                <button className={actionClass} disabled={saving}>
                  {editingPlanId ? "Salvar alterações" : "Salvar plano"}
                </button>
              </div>
            </form>
          )}
          {showForm && commercialTab === "contracts" && (
            <form onSubmit={submitSubscription} className={formClass}>
              <label className="block text-xs font-semibold text-[#64748b]">
                Empresa
                <select
                  required
                  value={subscriptionForm.companyId}
                  onChange={(event) =>
                    setSubscriptionForm({
                      ...subscriptionForm,
                      companyId: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#64748b]">
                Plano
                <select
                  required
                  value={subscriptionForm.planId}
                  onChange={(event) =>
                    setSubscriptionForm({
                      ...subscriptionForm,
                      planId: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {plans
                    .filter((plan) => plan.isActive)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} · {money(plan.monthlyPrice)}/mês
                      </option>
                    ))}
                </select>
              </label>
              {!plans.some((plan) => plan.isActive) && (
                <div
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2"
                >
                    Não há planos ativos disponíveis para contratar.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setPlanForm({
                          name: "",
                          description: "",
                          monthlyPrice: "",
                          annualPrice: "",
                          monthlyOrderLimit: "",
                        })
                        setCommercialTab("plans")
                        setShowForm(true)
                      }}
                      className="font-bold underline underline-offset-2"
                    >
                      Cadastrar um plano
                    </button>
                </div>
              )}
              <Input
                label="Data de renovação"
                type="date"
                value={subscriptionForm.renewalAt}
                onChange={(event) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    renewalAt: event.target.value,
                  })
                }
              />
              <p className="text-xs text-[#718096] md:col-span-2">
                A criação encerra a assinatura ativa anterior da empresa,
                preservando-a como histórico.
              </p>
              <div className="flex items-end">
                <button
                  className={actionClass}
                  disabled={saving || !plans.some((plan) => plan.isActive)}
                >
                  Criar contrato
                </button>
              </div>
            </form>
          )}
          {commercialTab === "leads" && (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible">
              {LEAD_STAGES.map((stage) => {
                const stageLeads = leads.filter(
                  (lead) => lead.stage === stage.id,
                )

                return (
                  <section
                    key={stage.id}
                    className="w-[min(82vw,300px)] shrink-0 snap-start rounded-2xl border border-[#e8edf4] bg-[#f8fafc] p-3 xl:w-auto xl:min-w-0"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#102b55]">
                        {stage.label}
                      </h3>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#718096]">
                        {stageLeads.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stageLeads.map((lead) => (
                        <article
                          key={lead.id}
                          className="rounded-xl border border-[#e8edf4] bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <b className="block text-sm text-[#102b55]">
                              {lead.companyName}
                            </b>
                            <button
                              type="button"
                              onClick={() => editLead(lead)}
                              aria-label={`Editar lead ${lead.companyName}`}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#718096] hover:bg-[#f5f7fb] hover:text-[#c76216]"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[#718096]">
                            {lead.contactName}
                            {lead.city ? ` · ${lead.city}` : ""}
                          </p>
                          {lead.estimatedMonthlyRevenue != null && (
                            <p className="mt-2 text-xs font-bold text-[#c76216]">
                              {money(lead.estimatedMonthlyRevenue)}/mês estimado
                            </p>
                          )}
                          {lead.source && (
                            <p className="mt-1 text-[10px] text-[#94a3b8]">
                              Origem: {lead.source}
                            </p>
                          )}
                          {lead.followUpAt && (
                            <p className="mt-2 text-[10px] font-semibold text-[#64748b]">
                              Próximo contato: {calendarDate(lead.followUpAt)}
                            </p>
                          )}
                          {lead.notes && (
                            <p className="mt-2 line-clamp-2 text-[10px] text-[#718096]">
                              {lead.notes}
                            </p>
                          )}
                          <select
                            aria-label={`Etapa de ${lead.companyName}`}
                            value={lead.stage}
                            onChange={(event) =>
                              void runSave(
                                () =>
                                  saveAdminLead(
                                    token,
                                    {
                                      companyName: lead.companyName,
                                      contactName: lead.contactName,
                                      stage: event.target
                                        .value as ApiLead["stage"],
                                    },
                                    lead.id,
                                  ),
                                "Etapa do lead atualizada.",
                              )
                            }
                            className="mt-3 h-8 w-full rounded-lg border border-[#e8edf4] px-2 text-[11px] text-[#475569]"
                          >
                            {LEAD_STAGES.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </article>
                      ))}
                      {stageLeads.length === 0 && (
                        <p className="py-4 text-center text-[10px] text-[#94a3b8]">
                          Nenhum lead.
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
          {commercialTab === "plans" && (
            <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
              <table className="w-full min-w-[650px] text-left text-xs">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8ba1]">
                  <tr>
                    {[
                      "Plano",
                      "Mensal",
                      "Anual",
                      "Pedidos/mês",
                      "Assinaturas",
                      "Status",
                      "Ações",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-t border-[#f1f4f8]">
                      <td className="px-4 py-3 font-bold text-[#102b55]">
                        {plan.name}
                        <small className="mt-1 block font-normal text-[#718096]">
                          {plan.description || "—"}
                        </small>
                      </td>
                      <td className="px-4 py-3">{money(plan.monthlyPrice)}</td>
                      <td className="px-4 py-3">{money(plan.annualPrice)}</td>
                      <td className="px-4 py-3">
                        {plan.monthlyOrderLimit ?? "Sem limite definido"}
                      </td>
                      <td className="px-4 py-3">
                        {plan._count?.subscriptions ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            void runSave(
                              () =>
                                updateAdminPlan(token, plan.id, {
                                  isActive: !plan.isActive,
                                }),
                              "Status do plano atualizado.",
                            )
                          }
                          className={`rounded-full px-2.5 py-1 font-bold ${
                            plan.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {plan.isActive ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => editPlan(plan)}
                          aria-label={`Editar plano ${plan.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8edf4] text-[#52657f] hover:border-[#f47b20] hover:text-[#c76216]"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plans.length === 0 && (
                <p className="p-8 text-center text-sm text-[#718096]">
                  Nenhum plano cadastrado.
                </p>
              )}
            </div>
          )}
          {commercialTab === "contracts" && (
            <>
              {editingSubscriptionId && (
                <form
                  onSubmit={submitSubscriptionUpdate}
                  className={formClass}
                >
                  <Input
                    label="Mensalidade do contrato (R$)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={subscriptionEditForm.monthlyPrice}
                    onChange={(event) =>
                      setSubscriptionEditForm({
                        ...subscriptionEditForm,
                        monthlyPrice: event.target.value,
                      })
                    }
                  />
                  <Input
                    label="Data de renovação"
                    type="date"
                    value={subscriptionEditForm.renewalAt}
                    onChange={(event) =>
                      setSubscriptionEditForm({
                        ...subscriptionEditForm,
                        renewalAt: event.target.value,
                      })
                    }
                  />
                  <div className="flex items-end gap-2">
                    <button className={actionClass} disabled={saving}>
                      Salvar alterações
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSubscriptionId(null)}
                      className="h-10 rounded-xl border border-[#e2e8f0] px-4 text-xs font-bold text-[#52657f]"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  label="Buscar contrato"
                  placeholder="Empresa ou plano"
                  value={subscriptionSearch}
                  onChange={(event) => setSubscriptionSearch(event.target.value)}
                />
                <label className="block text-xs font-semibold text-[#64748b] sm:min-w-48">
                  Status
                  <select
                    value={subscriptionStatusFilter}
                    onChange={(event) =>
                      setSubscriptionStatusFilter(
                        event.target.value as
                          | "ALL"
                          | ApiSubscription["status"],
                      )
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
                  >
                    <option value="ALL">Todos</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="OVERDUE">Vencidos</option>
                    <option value="INACTIVE">Inativos</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-[#718096]" aria-live="polite">
                Exibindo {filteredSubscriptions.length} de{" "}
                {subscriptions.length} contratos
              </p>
              <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
                <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8ba1]">
                  <tr>
                    {[
                      "Empresa",
                      "Plano",
                      "Início",
                      "Renovação",
                      "MRR",
                      "Status",
                      "Ações",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((item) => (
                    <tr key={item.id} className="border-t border-[#f1f4f8]">
                      <td className="px-4 py-3 font-bold text-[#102b55]">
                        {item.company?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{item.plan.name}</td>
                      <td className="px-4 py-3">{date(item.startedAt)}</td>
                      <td className="px-4 py-3">
                        {calendarDate(item.renewalAt)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {money(item.monthlyPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.status}
                          aria-label={`Status de ${item.company?.name ?? "assinatura"}`}
                          onChange={(event) =>
                            void runSave(
                              () =>
                                updateAdminSubscription(token, item.id, {
                                  status: event.target
                                    .value as ApiSubscription["status"],
                                }),
                              "Status da assinatura atualizado.",
                            )
                          }
                          className="rounded-lg border border-[#e8edf4] px-2 py-1"
                        >
                          <option value="ACTIVE">Ativa</option>
                          <option value="OVERDUE">Vencida</option>
                          <option value="INACTIVE">Inativa</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => editSubscription(item)}
                          aria-label={`Editar contrato de ${item.company?.name ?? "empresa"}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8edf4] text-[#52657f] hover:border-[#f47b20] hover:text-[#c76216]"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {subscriptions.length === 0 && (
                <p className="p-8 text-center text-sm text-[#718096]">
                  Nenhuma assinatura cadastrada.
                </p>
              )}
              {subscriptions.length > 0 && filteredSubscriptions.length === 0 && (
                <p className="p-8 text-center text-sm text-[#718096]">
                  Nenhum contrato corresponde aos filtros selecionados.
                </p>
              )}
              </div>
            </>
          )}
        </>
      )}

      {mode === "finance" && (
        <>
          {showForm && (
            <form onSubmit={submitEntry} className={formClass}>
              <label className="block text-xs font-semibold text-[#64748b]">
                Tipo
                <select
                  value={entryForm.type}
                  onChange={(event) =>
                    setEntryForm({
                      ...entryForm,
                      type: event.target.value as ApiFinancialEntry["type"],
                    })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm"
                >
                  <option value="INCOME">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </label>
              <Input
                label="Descrição"
                required
                value={entryForm.description}
                onChange={(event) =>
                  setEntryForm({
                    ...entryForm,
                    description: event.target.value,
                  })
                }
              />
              <Input
                label="Categoria"
                required
                value={entryForm.category}
                onChange={(event) =>
                  setEntryForm({ ...entryForm, category: event.target.value })
                }
              />
              <Input
                label="Valor (R$)"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={entryForm.amount}
                onChange={(event) =>
                  setEntryForm({ ...entryForm, amount: event.target.value })
                }
              />
              <label className="block text-xs font-semibold text-[#64748b]">
                Empresa (opcional)
                <select
                  value={entryForm.companyId}
                  onChange={(event) =>
                    setEntryForm({
                      ...entryForm,
                      companyId: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm"
                >
                  <option value="">Operação</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className={actionClass} disabled={saving}>
                  Registrar lançamento
                </button>
              </div>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="MRR contratado"
              value={money(monthlyRecurringRevenue)}
              detail="Assinaturas ativas"
            />
            <Metric
              label="ARR estimado"
              value={money(monthlyRecurringRevenue * 12)}
              detail="MRR × 12; projeção, não caixa recebido"
            />
            <Metric
              label="Assinaturas vencidas"
              value={money(overdueValue)}
              detail={`${subscriptions.filter((item) => item.status === "OVERDUE").length} contratos sinalizados`}
            />
            <Metric
              label="Saldo do mês"
              value={money(currentMonthIncome - currentMonthExpenses)}
              detail={`Receitas ${money(currentMonthIncome)} · despesas ${money(currentMonthExpenses)}`}
            />
          </div>
          <Suspense
            fallback={
              <div className="h-64 rounded-2xl border border-[#e8edf4] bg-white p-5 text-xs text-[#8795a8]">
                Carregando gráfico...
              </div>
            }
          >
            <FinancialChart months={chartMonths} />
          </Suspense>
          <form
            onSubmit={applyEntryFilters}
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Input
              label="Buscar lançamento"
              placeholder="Descrição, categoria ou empresa"
              value={entrySearch}
              onChange={(event) => setEntrySearch(event.target.value)}
            />
            <label className="block text-xs font-semibold text-[#64748b] sm:min-w-48">
              Tipo
              <select
                value={entryTypeFilter}
                onChange={(event) =>
                  setEntryTypeFilter(
                    event.target.value as
                      | "ALL"
                      | ApiFinancialEntry["type"],
                  )
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
              >
                <option value="ALL">Receitas e despesas</option>
                <option value="INCOME">Receitas</option>
                <option value="EXPENSE">Despesas</option>
              </select>
            </label>
            <Input
              label="Data inicial"
              type="date"
              value={entryFrom}
              max={entryTo || undefined}
              onChange={(event) => setEntryFrom(event.target.value)}
            />
            <Input
              label="Data final"
              type="date"
              value={entryTo}
              min={entryFrom || undefined}
              onChange={(event) => setEntryTo(event.target.value)}
            />
            <div className="flex items-end sm:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={loading || loadingMoreEntries}
                className={actionClass}
              >
                Aplicar filtros
              </button>
            </div>
          </form>
          <p className="text-xs text-[#718096]" aria-live="polite">
            Exibindo {entries.length} de {entryTotal} lançamentos que
            correspondem aos filtros aplicados.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8ba1]">
                <tr>
                  {[
                    "Data",
                    "Tipo",
                    "Descrição",
                    "Categoria",
                    "Empresa",
                    "Valor",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#f1f4f8]">
                    <td className="px-4 py-3">{date(entry.occurredAt)}</td>
                    <td className="px-4 py-3">
                      {entry.type === "INCOME" ? "Receita" : "Despesa"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#102b55]">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3">{entry.category}</td>
                    <td className="px-4 py-3">
                      {entry.company?.name ?? "Operação"}
                    </td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        entry.type === "INCOME"
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {entry.type === "INCOME" ? "+" : "−"}{" "}
                      {money(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                {entryTotal === 0
                  ? loading
                    ? "Carregando lançamentos..."
                    : "Nenhum lançamento corresponde aos filtros."
                  : "Carregando lançamentos correspondentes..."}
              </p>
            )}
          </div>
          {entries.length < entryTotal && (
            <button
              type="button"
              onClick={() => void loadMoreEntries()}
              disabled={loadingMoreEntries}
              className="mx-auto flex h-10 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-4 text-xs font-bold text-[#52657f] disabled:opacity-50"
            >
              {loadingMoreEntries
                ? "Carregando..."
                : `Carregar mais (${entryTotal - entries.length} restantes)`}
            </button>
          )}
        </>
      )}

      {mode === "users" && (
        <>
          {showForm && (
            <form onSubmit={submitUser} className={formClass}>
              <Input
                label="Nome"
                required
                value={userForm.name}
                onChange={(event) =>
                  setUserForm({ ...userForm, name: event.target.value })
                }
              />
              <Input
                label="E-mail"
                type="email"
                required
                value={userForm.email}
                onChange={(event) =>
                  setUserForm({ ...userForm, email: event.target.value })
                }
              />
              <Input
                label="Telefone"
                value={userForm.phone}
                onChange={(event) =>
                  setUserForm({ ...userForm, phone: event.target.value })
                }
              />
              <Input
                label="Senha inicial (mínimo 12 caracteres)"
                type="password"
                minLength={12}
                required
                value={userForm.password}
                onChange={(event) =>
                  setUserForm({ ...userForm, password: event.target.value })
                }
              />
              <label className="block text-xs font-semibold text-[#64748b]">
                Perfil
                <select
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm({
                      ...userForm,
                      role: event.target.value as ApiSystemUser["role"],
                    })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="COURIER">Motoboy</option>
                  <option value="COMPANY">Empresa</option>
                </select>
              </label>
              <p className="text-xs text-[#718096]">
                {userForm.role === "COMPANY"
                  ? "A empresa poderá alterar a senha depois, em Segurança da conta no painel empresarial."
                  : "A senha inicial será usada para entrar no painel. Compartilhe-a com a pessoa por um canal seguro."}
              </p>
              <div className="flex items-end">
                <button className={actionClass} disabled={saving}>
                  Criar{" "}
                  {userForm.role === "COURIER"
                    ? "motoboy"
                    : userForm.role === "COMPANY"
                      ? "conta empresarial"
                      : "administrador"}
                </button>
              </div>
            </form>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              label="Buscar usuário"
              placeholder="Nome ou e-mail"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
            />
            <label className="block text-xs font-semibold text-[#64748b] sm:min-w-48">
              Status
              <select
                value={userStatusFilter}
                onChange={(event) =>
                  setUserStatusFilter(
                    event.target.value as "ALL" | "ACTIVE" | "INACTIVE",
                  )
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-[#718096]" aria-live="polite">
            Exibindo {filteredUsers.length} de {users.length} usuários
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8ba1]">
                <tr>
                  {["Nome", "Perfil", "E-mail", "Criado em", "Status"].map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                  <tr className="border-t border-[#f1f4f8]">
                    <td className="px-4 py-3 font-bold text-[#102b55]">
                      {user.name}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "COURIER"
                        ? "Motoboy"
                        : user.role === "COMPANY"
                          ? "Empresa"
                          : "Administrador"}
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{date(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            void runSave(
                              () =>
                                updateAdminSystemUser(
                                  token,
                                  user.id,
                                  !user.isActive,
                                ),
                              "Acesso da conta atualizado.",
                            )
                          }
                          className={`rounded-full px-2.5 py-1 font-bold ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.isActive
                            ? "Ativo · desativar"
                            : "Inativo · ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError("")
                            setNotice("")
                            setTemporaryPassword(null)
                            setPasswordResetUserId((current) =>
                              current === user.id ? null : user.id,
                            )
                          }}
                          aria-label={`Redefinir senha de ${user.name}`}
                          className="rounded-full border border-[#e2e8f0] p-2 text-[#52657f]"
                        >
                          <KeyRound size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {passwordResetUserId === user.id && (
                    <tr className="border-t border-[#f1f4f8]">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-[#52657f]">
                            Gere uma senha temporária para {user.name}. Ela
                            aparecerá uma vez para compartilhamento seguro.
                          </p>
                          <button
                            type="button"
                            onClick={() => void resetUserPassword(user)}
                            disabled={saving}
                            className={`${actionClass} shrink-0`}
                          >
                            <KeyRound size={14} />
                            Gerar senha temporária
                          </button>
                        </div>
                        {temporaryPassword?.userId === user.id && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Input
                              label="Senha temporária · copie e compartilhe com segurança"
                              value={temporaryPassword.password}
                              readOnly
                            />
                            <button
                              type="button"
                              onClick={() => void copyTemporaryPassword()}
                              className={`${actionClass} shrink-0 sm:self-end`}
                            >
                              <Copy size={14} />
                              Copiar senha
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                Nenhum usuário cadastrado.
              </p>
            )}
            {users.length > 0 && filteredUsers.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                Nenhum usuário corresponde aos filtros selecionados.
              </p>
            )}
          </div>
        </>
      )}

      {mode === "audit" && (
        <>
          <div className="flex flex-col gap-2 xl:flex-row">
            <Input
              label="Buscar atividade"
              placeholder="Usuário, ação, registro ou detalhe"
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
            />
            <label className="block text-xs font-semibold text-[#64748b] xl:min-w-48">
              Ação
              <select
                value={auditActionFilter}
                onChange={(event) => setAuditActionFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
              >
                <option value="ALL">Todas</option>
                {auditActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#64748b] xl:min-w-48">
              Registro
              <select
                value={auditEntityFilter}
                onChange={(event) => setAuditEntityFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-normal text-[#102b55]"
              >
                <option value="ALL">Todos</option>
                {auditEntities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-[#718096]" aria-live="polite">
            Exibindo {filteredLogs.length} de {logs.length} atividades
            carregadas (máximo de 500).
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8ba1]">
                <tr>
                  {["Data e hora", "Usuário", "Ação", "Registro", "Detalhes"].map(
                    (header) => (
                      <th key={header} className="px-4 py-3">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-[#f1f4f8]">
                    <td className="px-4 py-3">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#102b55]">
                      {log.actorName}
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">
                      {log.entity}
                      {log.entityId ? ` · ${log.entityId}` : ""}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-[#718096]">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                Nenhuma atividade registrada.
              </p>
            )}
            {logs.length > 0 && filteredLogs.length === 0 && (
              <p className="p-8 text-center text-sm text-[#718096]">
                Nenhuma atividade corresponde aos filtros selecionados.
              </p>
            )}
          </div>
        </>
      )}

      {mode === "integrations" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => {
            const tone =
              integration.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700"
                : integration.status === "SETUP_REQUIRED"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"

            const label =
              integration.status === "ACTIVE"
                ? "Ativo"
                : integration.status === "SETUP_REQUIRED"
                  ? "Configuração necessária"
                  : "Não integrado"

            return (
              <article
                key={integration.id}
                className="rounded-2xl border border-[#e8edf4] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-[#102b55]">
                    {integration.name}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}
                  >
                    {label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#64748b]">
                  {integration.description}
                </p>
                <p className="mt-3 flex gap-2 text-[11px] text-[#8795a8]">
                  <Activity size={14} className="shrink-0" />
                  {integration.note}
                </p>
              </article>
            )
          })}
          {integrations.length === 0 && !loading && (
            <p className="rounded-2xl border border-[#e8edf4] bg-white p-8 text-sm text-[#718096]">
              Não foi possível determinar o estado das integrações.
            </p>
          )}
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800 md:col-span-2 xl:col-span-3">
            <ShieldCheck size={16} className="shrink-0" />
            <p>
              Tokens, chaves privadas e credenciais são configurados apenas nos
              secrets do servidor e nunca são enviados ao navegador.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
