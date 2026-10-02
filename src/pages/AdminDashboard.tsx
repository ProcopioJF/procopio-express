import { useCallback, useEffect, useMemo, useState } from "react"

import {
  Activity,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  Download,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react"

import DashboardChartsPanel from "../components/DashboardChartsPanel"

import IntelligencePanel from "../components/IntelligencePanel"

import AdminBusinessPanel from "../components/AdminBusinessPanel"

import AdminPricingPanel from "../components/AdminPricingPanel"

import Logo from "../components/Logo"

import {
  formatOrderPrice,
  getAdminCompanies,
  getAdminPriceTables,
  getDashboardSummary,
  getPanelOrders,
  getSettings,
  saveSettings,
  type ApiCompany,
  type ApiDashboardSummary,
  type ApiOrder,
  type ApiPriceTable,
  type ApiSettings,
  type ApiUser,
} from "../services/api"

type Section = "overview" | "intelligence" | "companies" | "commercial" | "orders" | "finance" | "administration"

type AdminTab = "routes" | "settings" | "users" | "audit" | "integrations"

const NAV: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Centro de Controle", icon: LayoutDashboard },

  { id: "intelligence", label: "Procópio Intelligence", icon: Sparkles },

  { id: "companies", label: "Empresas", icon: Building2 },

  { id: "commercial", label: "Gestão Comercial", icon: Users },

  { id: "orders", label: "Pedidos", icon: Package },

  { id: "finance", label: "Financeiro", icon: CircleDollarSign },

  { id: "administration", label: "Administração", icon: Settings },
]

const EMPTY_SUMMARY: ApiDashboardSummary = {
  today: { orders: 0, total: 0, average: 0 },

  week: { orders: 0, total: 0, average: 0 },

  month: { orders: 0, total: 0, average: 0 },

  allTime: { orders: 0, total: 0, average: 0 },

  timezone: "America/Sao_Paulo",
}

const EMPTY_SETTINGS: ApiSettings = {
  companyName: "Procópio Express",

  whatsappOperationsNumber: "",

  collectionDeadlineMinutes: 40,

  supportPhone: "",

  operationCity: "Juiz de Fora",

  confirmationMessage: "",
}

const money = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const address = (
  street?: string | null,
  number?: string | null,
  neighborhood?: string | null,
) => [street, number, neighborhood].filter(Boolean).join(", ") || "—"

function MetricCard({
  label,

  value,

  detail,

  icon: Icon,

  tone,
}: {
  label: string

  value: string

  detail: string

  icon: typeof Package

  tone: string
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#e8edf4] bg-white p-4 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7b8ba1]">
          {label}
        </p>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <strong className="mt-3 block truncate text-xl font-extrabold tracking-tight text-[#102b55]">
        {value}
      </strong>
      <p className="mt-1 truncate text-[10px] text-[#94a3b8]">{detail}</p>
    </article>
  )
}

function OrderTable({ orders }: { orders: ApiOrder[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
      <table className="w-full min-w-[1050px] text-left">
        <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wider text-[#7b8ba1]">
          <tr>
            {[
              "Registro / data",
              "Solicitante",
              "Coleta",
              "Entrega",
              "Valor",
              "Unidade / centro de custo",
              "Status",
              "Empresa",
            ].map((label) => (
              <th key={label} className="px-4 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-t border-[#f1f4f8] text-xs hover:bg-[#fbfcfe]"
            >
              <td className="px-4 py-3">
                <b className="block font-mono text-[#102b55]">
                  {order.publicId}
                </b>
                <span className="mt-1 block text-[#94a3b8]">
                  {new Date(order.createdAt).toLocaleString("pt-BR")}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-[#334155]">
                {order.requesterName || order.recipientName}
                <span className="mt-1 block font-normal text-[#7b8ba1]">
                  {order.requesterPhone || order.recipientPhone || "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#64748b]">
                {address(
                  order.pickupStreet,
                  order.pickupNumber,
                  order.pickupNeighborhood,
                )}
              </td>
              <td className="px-4 py-3 text-[#64748b]">
                {address(
                  order.deliveryStreet,
                  order.deliveryNumber,
                  order.deliveryNeighborhood,
                )}
              </td>
              <td className="px-4 py-3 font-bold text-[#102b55]">
                {formatOrderPrice(order)}
              </td>
              <td className="px-4 py-3 text-[#64748b]">
                {[order.branch?.name, order.costCenter?.name].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-bold ${
                    order.status === "CANCELLED"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {order.status === "CANCELLED" ? "Cancelada" : "Concluída"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#64748b]">
                {order.companyId ? "Empresarial" : "Avulso"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="p-10 text-center text-sm text-[#7b8ba1]">
          Nenhum pedido registrado neste filtro.
        </p>
      )}
    </div>
  )
}

export default function AdminDashboard({
  token,

  user,

  onLogout,

  onNewOrder,
}: {
  token: string

  user: ApiUser

  onLogout: () => void

  onNewOrder: () => void
}) {
  const [section, setSection] = useState<Section>("overview")

  const [adminTab, setAdminTab] = useState<AdminTab>("routes")

  const [orders, setOrders] = useState<ApiOrder[]>([])

  const [companies, setCompanies] = useState<ApiCompany[]>([])

  const [priceTables, setPriceTables] = useState<ApiPriceTable[]>([])

  const [summary, setSummary] = useState(EMPTY_SUMMARY)

  const [settings, setSettings] = useState(EMPTY_SETTINGS)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const [search, setSearch] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      const [
        orderResult,
        summaryResult,
        companyResult,
        priceTableResult,
        settingsResult,
      ] = await Promise.all([
        getPanelOrders(token, "admin"),

        getDashboardSummary(token),

        getAdminCompanies(token),

        getAdminPriceTables(token),

        getSettings(token),
      ])

      setOrders(orderResult.orders)

      setSummary(summaryResult.summary)

      setCompanies(companyResult.companies)

      setPriceTables(priceTableResult.tables)

      setSettings(settingsResult.settings)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o painel.",
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredOrders = useMemo(() => {
    const needle = search.toLocaleLowerCase("pt-BR")

    return orders.filter((order) =>
      [
        order.publicId,
        order.requesterName ?? "",
        order.recipientName,
        order.deliveryNeighborhood ?? "",
        order.pickupNeighborhood ?? "",
      ]

        .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)),
    )
  }, [orders, search])

  const title =
    NAV.find((item) => item.id === section)?.label ?? "Centro de Controle"

  const activeRoutes = priceTables.filter((table) => table.active).length

  const exportOrders = () => {
    const rows = [
      [
        "Número",
        "Data",
        "Solicitante",
        "Telefone do solicitante",
        "Destinatário",
        "Telefone do destinatário",
        "Coleta",
        "Entrega",
        "Valor",
        "Tipo",
      ],

      ...filteredOrders.map((order) => [
        order.publicId,

        new Date(order.createdAt).toLocaleString("pt-BR"),

        order.requesterName ?? "",

        order.requesterPhone ?? "",

        order.recipientName,

        order.recipientPhone ?? "",

        address(
          order.pickupStreet,
          order.pickupNumber,
          order.pickupNeighborhood,
        ),

        address(
          order.deliveryStreet,
          order.deliveryNumber,
          order.deliveryNeighborhood,
        ),

        formatOrderPrice(order),

        order.companyId ? "Empresarial" : "Avulso",
      ]),
    ]

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"),
      )
      .join("\r\n")

    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    )

    const link = document.createElement("a")

    link.href = url

    link.download = "procopio-pedidos.csv"

    link.click()

    URL.revokeObjectURL(url)
  }

  const saveOperation = async () => {
    setSaving(true)

    setError("")

    setNotice("")

    try {
      const result = await saveSettings(token, settings)

      setSettings(result.settings)

      setNotice("Configurações salvas.")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar as configurações.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] text-[#1a2b43]">
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-[#e8edf4] bg-white">
        <div className="flex h-[74px] items-center border-b border-[#edf1f6] px-5">
          <Logo
            variant="horizontal"
            className="h-8 max-w-[172px] object-contain object-left"
          />
        </div>
        <div className="mx-4 mt-4 rounded-xl border border-[#f6d7bf] bg-[#fff8f1] px-3 py-2.5">
          <b className="block text-[11px] text-[#c76216]">
            ⚡ Painel Administrador
          </b>
          <small className="mt-1 block text-[10px] text-[#8795a8]">
            Procópio Express · Controle Total
          </small>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                section === id
                  ? "bg-[#f47b20] text-white shadow-sm shadow-orange-200"
                  : "text-[#718096] hover:bg-[#f5f7fb] hover:text-[#102b55]"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#edf1f6] p-3">
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-[#f8fafc] p-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffead8] text-[10px] font-bold text-[#c76216]">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <b className="block truncate text-xs text-[#102b55]">
                {user.name}
              </b>
              <small className="text-[10px] text-[#8795a8]">
                Super Administrador
              </small>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718096] hover:bg-[#fff4ef] hover:text-[#c76216]"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-[74px] items-center justify-between gap-4 border-b border-[#e8edf4] bg-white/95 px-5 py-3 backdrop-blur sm:px-7">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#f47b20]">
              PAINEL ADMINISTRATIVO
            </p>
            <h1 className="mt-1 truncate text-base font-bold text-[#102b55]">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative hidden w-48 md:block xl:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa8b8]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                className="h-9 w-full rounded-full border border-[#edf1f6] bg-[#f9fafc] pl-9 pr-3 text-xs outline-none focus:border-[#f47b20]"
              />
            </label>
            <button
              onClick={() => void refresh()}
              aria-label="Atualizar dados"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#e8edf4] text-[#718096] hover:bg-[#f8fafc]"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onNewOrder}
              className="flex h-9 items-center gap-2 rounded-xl bg-[#f47b20] px-3 text-xs font-bold text-white transition hover:bg-[#df6d17] sm:px-4"
            >
              <Plus size={14} /> Registrar pedido
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-[1550px] space-y-5 p-4 sm:p-6">
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
              <button
                className="float-right"
                aria-label="Fechar aviso"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <p className="text-xs text-[#718096]">
              Carregando dados da operação…
            </p>
          )}

          {section === "overview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#f47b20]">
                    Administração central · {settings.operationCity}
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#102b55]">
                    Olá, {user.name.split(" ")[0]}.
                  </h2>
                </div>
                <span className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 text-[10px] text-[#718096]">
                  Atualizado em {new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total de empresas"
                  value={`${companies.length}`}
                  detail="Cadastradas na plataforma"
                  icon={Building2}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Empresas com acesso"
                  value={`${companies.filter((company) => company._count.users > 0).length}`}
                  detail="Com usuários cadastrados"
                  icon={Users}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Tabelas ativas"
                  value={`${activeRoutes}`}
                  detail="Disponíveis para cotação"
                  icon={Route}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Total de entregas"
                  value={summary.allTime.orders.toLocaleString("pt-BR")}
                  detail="Histórico geral"
                  icon={Package}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Entregas hoje"
                  value={`${summary.today.orders}`}
                  detail="Todas as empresas"
                  icon={Activity}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Faturamento hoje"
                  value={money(summary.today.total)}
                  detail={`${summary.today.orders} pedidos`}
                  icon={CircleDollarSign}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Faturamento mês"
                  value={money(summary.month.total)}
                  detail={`${summary.month.orders} pedidos`}
                  icon={CircleDollarSign}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Ticket médio global"
                  value={money(summary.allTime.average)}
                  detail="Por entrega registrada"
                  icon={ChartNoAxesCombined}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <DashboardChartsPanel
                orders={orders}
                companies={companies}
                audience="admin"
              />
            </div>
          )}

          {section === "intelligence" && (
            <IntelligencePanel
              orders={orders}
              summary={summary}
              companies={companies}
              companyName={settings.companyName}
              audience="admin"
            />
          )}

          {section === "companies" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#102b55]">
                  Empresas cadastradas
                </h2>
                <p className="mt-1 text-xs text-[#8795a8]">
                  Contas empresariais vinculadas à plataforma.
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wider text-[#7b8ba1]">
                    <tr>
                      {[
                        "Empresa",
                        "Documento",
                        "Plano",
                        "Entregas/mês",
                        "MRR",
                        "Usuários",
                        "Status",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr
                        key={company.id}
                        className="border-t border-[#f1f4f8] text-sm"
                      >
                        <td className="px-4 py-3 font-semibold text-[#102b55]">
                          {company.name}
                        </td>
                        <td className="px-4 py-3 text-[#64748b]">
                          {company.document || "—"}
                        </td>
                        <td className="px-4 py-3 text-[#334155]">
                          {company.subscription?.plan.name ?? "Sem plano"}
                        </td>
                        <td className="px-4 py-3 text-[#334155]">
                          {(company.monthlyOrders ?? 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#102b55]">
                          {company.subscription ? money(Number(company.subscription.monthlyPrice)) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#334155]">
                          {company._count.users}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              company.subscription?.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : company.subscription?.status === "OVERDUE"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {company.subscription?.status === "ACTIVE"
                              ? "Ativa"
                              : company.subscription?.status === "OVERDUE"
                                ? "Vencida"
                                : "Sem contrato"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {companies.length === 0 && (
                  <p className="p-10 text-center text-sm text-[#7b8ba1]">
                    Nenhuma empresa cadastrada.
                  </p>
                )}
              </div>
            </div>
          )}

          {section === "orders" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#102b55]">
                    Gestão Comercial
                  </h2>
                  <p className="mt-1 text-xs text-[#8795a8]">
                    Pedidos avulsos e empresariais · até os 100 registros mais
                    recentes.
                  </p>
                </div>
                <button
                  onClick={exportOrders}
                  className="flex h-9 items-center gap-2 rounded-xl border border-[#e8edf4] bg-white px-3 text-xs font-bold text-[#102b55]"
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
              <OrderTable orders={filteredOrders} />
            </div>
          )}

          {section === "commercial" && (
            <AdminBusinessPanel token={token} mode="commercial" companies={companies} />
          )}

          {section === "finance" && (
            <AdminBusinessPanel token={token} mode="finance" companies={companies} />
          )}

          {section === "administration" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#102b55]">
                  Administração
                </h2>
                <p className="mt-1 text-xs text-[#8795a8]">
                  Gerencie acesso, auditoria, integrações, preços de rota e preferências da operação.
                </p>
              </div>
              <div className="flex gap-2 border-b border-[#e8edf4]">
                {([
                  ["routes", "Tabelas de preços", Route],
                  ["settings", "Configurações", Settings],
                  ["users", "Usuários", Users],
                  ["audit", "Logs & Auditoria", Activity],
                  ["integrations", "Integrações", ChartNoAxesCombined],
                ] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setAdminTab(id)}
                    className={`border-b-2 px-3 py-2 text-xs font-bold ${
                      adminTab === id
                        ? "border-[#f47b20] text-[#c76216]"
                        : "border-transparent text-[#718096]"
                    }`}
                  >
                    <Icon size={13} className="mr-1.5 inline" />
                    {label}
                  </button>
                ))}
              </div>
              {adminTab === "routes" && <AdminPricingPanel token={token} />}
              {adminTab === "settings" && (
                <div className="max-w-3xl rounded-2xl border border-[#e8edf4] bg-white p-6">
                  <h3 className="font-bold text-[#102b55]">
                    Configurações da operação
                  </h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {([
                      ["companyName", "Nome da operação"],
                      ["whatsappOperationsNumber", "WhatsApp operacional"],
                      ["supportPhone", "Telefone de suporte"],
                      ["operationCity", "Cidade de operação"],
                    ] as const).map(([key, label]) => (
                      <label
                        key={key}
                        className="text-xs font-semibold text-[#64748b]"
                      >
                        {label}
                        <input
                          value={settings[key]}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              [key]: event.target.value,
                            })
                          }
                          className="mt-1 block h-10 w-full rounded-xl border border-[#e2e8f4] bg-[#fbfcfe] px-3 text-sm text-[#102b55]"
                        />
                      </label>
                    ))}
                    <label className="text-xs font-semibold text-[#64748b]">
                      Prazo configurável (minutos)
                      <input
                        type="number"
                        min="1"
                        value={settings.collectionDeadlineMinutes}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            collectionDeadlineMinutes: Number(
                              event.target.value,
                            ),
                          })
                        }
                        className="mt-1 block h-10 w-full rounded-xl border border-[#e2e8f4] bg-[#fbfcfe] px-3 text-sm text-[#102b55]"
                      />
                    </label>
                    <label className="text-xs font-semibold text-[#64748b] sm:col-span-2">
                      Mensagem padrão
                      <textarea
                        value={settings.confirmationMessage}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            confirmationMessage: event.target.value,
                          })
                        }
                        rows={3}
                        className="mt-1 block w-full rounded-xl border border-[#e2e8f4] bg-[#fbfcfe] p-3 text-sm text-[#102b55]"
                      />
                    </label>
                  </div>
                  <button
                    disabled={saving}
                    onClick={() => void saveOperation()}
                    className="mt-5 rounded-xl bg-[#0c225a] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Salvando…" : "Salvar configurações"}
                  </button>
                </div>
              )}
              {adminTab === "users" && (
                <AdminBusinessPanel token={token} mode="users" />
              )}
              {adminTab === "audit" && (
                <AdminBusinessPanel token={token} mode="audit" />
              )}
              {adminTab === "integrations" && (
                <AdminBusinessPanel token={token} mode="integrations" />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
