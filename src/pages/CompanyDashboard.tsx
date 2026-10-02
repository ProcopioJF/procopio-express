import { useCallback, useEffect, useMemo, useState } from "react"

import {
  BarChart3,
  Building2,
  CircleDollarSign,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react"

import DashboardChartsPanel from "../components/DashboardChartsPanel"

import IntelligencePanel from "../components/IntelligencePanel"

import CompanyOrganizationPanel from "../components/CompanyOrganizationPanel"

import Logo from "../components/Logo"

import {
  formatOrderPrice,
  getCompanySettings,
  getDashboardSummary,
  getPanelOrders,
  saveCompanySettings,
  type ApiCompanySettings,
  type ApiDashboardSummary,
  type ApiOrder,
  type ApiUser,
} from "../services/api"

type Section = "overview" | "orders" | "intelligence" | "finance" | "reports" | "profile"

const NAV: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },

  { id: "orders", label: "Entregas", icon: Package },

  { id: "intelligence", label: "Procópio Intelligence", icon: Sparkles },

  { id: "finance", label: "Financeiro", icon: CircleDollarSign },

  { id: "reports", label: "Relatórios", icon: FileText },

  { id: "profile", label: "Perfil da Empresa", icon: Building2 },
]

const EMPTY_SUMMARY: ApiDashboardSummary = {
  today: { orders: 0, total: 0, average: 0 },

  week: { orders: 0, total: 0, average: 0 },

  month: { orders: 0, total: 0, average: 0 },

  allTime: { orders: 0, total: 0, average: 0 },

  timezone: "America/Sao_Paulo",
}

const EMPTY_PROFILE: ApiCompanySettings = {
  name: "",
  document: "",
  phone: "",
  email: "",
  address: "",
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

function OrdersTable({ orders }: { orders: ApiOrder[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white">
      <table className="w-full min-w-[1080px] text-left">
        <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wider text-[#7b8ba1]">
          <tr>
            {[
              "Nº / data",
              "Solicitante",
              "Destinatário",
              "Origem",
              "Destino",
              "Filial / centro de custo",
              "Valor",
              "Status",
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
              <td className="px-4 py-3 font-semibold text-[#334155]">
                {order.recipientName}
                <span className="mt-1 block font-normal text-[#7b8ba1]">
                  {order.recipientPhone || "—"}
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
              <td className="px-4 py-3 text-[#64748b]">
                {[order.branch?.name, order.costCenter?.name].filter(Boolean).join(" · ") || "Sede / não informado"}
              </td>
              <td className="px-4 py-3 font-bold text-[#102b55]">
                {formatOrderPrice(order)}
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
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="p-10 text-center text-sm text-[#7b8ba1]">
          Ainda não há entregas registradas para esta empresa.
        </p>
      )}
    </div>
  )
}

export default function CompanyDashboard({
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

  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [orders, setOrders] = useState<ApiOrder[]>([])

  const [summary, setSummary] = useState(EMPTY_SUMMARY)

  const [profile, setProfile] = useState(EMPTY_PROFILE)

  const [search, setSearch] = useState("")

  const [orderFilter, setOrderFilter] = useState<"all" | "completed">("all")

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      const [orderResult, summaryResult, profileResult] = await Promise.all([
        getPanelOrders(token, "company"),

        getDashboardSummary(token),

        getCompanySettings(token),
      ])

      setOrders(orderResult.orders)

      setSummary(summaryResult.summary)

      setProfile(profileResult.settings)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados da empresa.",
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
      (orderFilter === "all" || order.status !== "CANCELLED") &&
      [
          order.publicId,
          order.requesterName ?? "",
          order.recipientName,
          order.deliveryNeighborhood ?? "",
          order.pickupNeighborhood ?? "",
        ].some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)),
    )
  }, [orderFilter, orders, search])

  const exportCsv = () => {
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
        "Filial",
        "Centro de custo",
        "Valor",
        "Status",
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

        order.branch?.name ?? "",

        order.costCenter?.name ?? "",

        formatOrderPrice(order),

        order.status,
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

    link.download = "procopio-registros-empresa.csv"

    link.click()

    URL.revokeObjectURL(url)
  }

  const saveProfile = async () => {
    setSaving(true)

    setError("")

    setNotice("")

    try {
      const result = await saveCompanySettings(token, profile)

      setProfile(result.settings)

      setNotice("Perfil da empresa atualizado.")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o perfil.",
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOrganizationFeedback = useCallback((message: string, success = "") => {
    setError(message)
    setNotice(success)
  }, [])

  const title = NAV.find((item) => item.id === section)?.label ?? "Visão Geral"

  const companyName = profile.name || user.name

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] text-[#1a2b43]">
      <aside
        className={`${
          sidebarOpen ? "w-[252px]" : "w-[76px]"
        } flex shrink-0 flex-col border-r border-[#e8edf4] bg-white transition-[width]`}
      >
        <div
          className={`flex h-[74px] items-center border-b border-[#edf1f6] px-5 ${
            sidebarOpen ? "" : "justify-center"
          }`}
        >
          <Logo
            variant={sidebarOpen ? "horizontal" : "icon"}
            className={
              sidebarOpen
                ? "h-8 max-w-[172px] object-contain object-left"
                : "h-9 w-9 object-contain"
            }
          />
        </div>
        {sidebarOpen && (
          <div className="mx-4 mt-4 rounded-xl border border-[#e8edf4] bg-[#f8fafc] px-3 py-2.5">
            <b className="block truncate text-[11px] text-[#102b55]">
              {companyName}
            </b>
            <small className="mt-1 block text-[10px] text-[#8795a8]">
              Plano empresarial
            </small>
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              onClick={() => setSection(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                section === id
                  ? "bg-[#f47b20] text-white shadow-sm shadow-orange-200"
                  : "text-[#718096] hover:bg-[#f5f7fb] hover:text-[#102b55]"
              } ${sidebarOpen ? "" : "justify-center"}`}
            >
              <Icon size={17} />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl bg-[#f8fafc] p-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffead8] text-xs font-bold text-[#c76216]">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-xs text-[#102b55]">
                {user.name}
              </b>
              <small className="text-[10px] text-[#8795a8]">
                Gestor empresarial
              </small>
            </div>
          </div>
        )}
        <div className="border-t border-[#edf1f6] p-3">
          <button
            onClick={onLogout}
            title="Sair"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718096] hover:bg-[#fff4ef] hover:text-[#c76216] ${
              sidebarOpen ? "" : "justify-center"
            }`}
          >
            <LogOut size={16} />
            {sidebarOpen && "Sair"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-[74px] items-center justify-between gap-4 border-b border-[#e8edf4] bg-white/95 px-5 py-3 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label="Alternar menu"
              className="rounded-lg p-2 text-[#718096] hover:bg-[#f5f7fb]"
            >
              <BarChart3 size={17} />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#f47b20]">
                PAINEL EMPRESARIAL
              </p>
              <h1 className="mt-1 truncate text-base font-bold text-[#102b55]">
                {title}
              </h1>
            </div>
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
            {user.companyPermission !== "RESTRICTED" && (
              <button
                onClick={onNewOrder}
                className="flex h-9 items-center gap-2 rounded-xl bg-[#f47b20] px-3 text-xs font-bold text-white transition hover:bg-[#df6d17] sm:px-4"
              >
                <Package size={14} /> Registrar pedido
              </button>
            )}
          </div>
        </header>

        <section className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
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
            <p className="text-xs text-[#718096]">
              Atualizando dados da empresa…
            </p>
          )}

          {section === "overview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#f47b20]">
                    Resumo operacional
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#102b55]">
                    {companyName} · Juiz de Fora, MG
                  </h2>
                </div>
                <span className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 text-[10px] text-[#718096]">
                  Atualizado em {new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                  label="Entregas hoje"
                  value={`${summary.today.orders}`}
                  detail={`Últimas 24h · ${money(summary.today.total)}`}
                  icon={Package}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Entregas semana"
                  value={`${summary.week.orders}`}
                  detail={`Esta semana · ${money(summary.week.total)}`}
                  icon={BarChart3}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Entregas mês"
                  value={`${summary.month.orders}`}
                  detail={`Mês atual · ${money(summary.month.total)}`}
                  icon={Package}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Total de entregas"
                  value={summary.allTime.orders.toLocaleString("pt-BR")}
                  detail="Desde o início"
                  icon={LayoutDashboard}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
                <MetricCard
                  label="Ticket médio"
                  value={money(summary.allTime.average)}
                  detail="Por entrega registrada"
                  icon={CircleDollarSign}
                  tone="bg-[#fff5e7] text-[#c88724]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Gasto hoje"
                  value={money(summary.today.total)}
                  detail={`${summary.today.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Gasto semana"
                  value={money(summary.week.total)}
                  detail={`${summary.week.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Gasto mês"
                  value={money(summary.month.total)}
                  detail={`${summary.month.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Gasto total"
                  value={money(summary.allTime.total)}
                  detail="Histórico consolidado"
                  icon={CircleDollarSign}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <DashboardChartsPanel orders={orders} />
            </div>
          )}

          {section === "orders" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#102b55]">
                    Entregas registradas
                  </h2>
                  <p className="mt-1 text-xs text-[#8795a8]">
                    Até os 100 registros mais recentes da empresa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-[#e8edf4] bg-white p-1">
                    {(
                      [
                        ["all", "Todos"],
                        ["completed", "Concluídas"],
                      ] as const
                    ).map(([filter, label]) => (
                      <button
                        key={filter}
                        onClick={() => setOrderFilter(filter)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          orderFilter === filter
                            ? "bg-[#fff3e9] text-[#c76216]"
                            : "text-[#718096] hover:bg-[#f8fafc]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="relative md:hidden">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa8b8]"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar…"
                      className="h-9 w-40 rounded-xl border border-[#e8edf4] bg-white pl-9 pr-3 text-xs"
                    />
                  </label>
                  <button
                    onClick={exportCsv}
                    className="flex h-9 items-center gap-2 rounded-xl border border-[#e8edf4] bg-white px-3 text-xs font-bold text-[#102b55]"
                  >
                    <Download size={14} /> Exportar
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#8795a8]">
                As solicitações do portal são registradas como concluídas.
                Registros cancelados permanecem no histórico e aparecem em
                “Todos”.
              </p>
              <OrdersTable orders={filteredOrders} />
            </div>
          )}

          {section === "intelligence" && (
            <IntelligencePanel
              orders={orders}
              summary={summary}
              companyName={companyName}
            />
          )}

          {section === "finance" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#102b55]">Financeiro</h2>
                <p className="mt-1 text-xs text-[#8795a8]">
                  Despesas calculadas a partir dos pedidos registrados.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Gasto hoje"
                  value={money(summary.today.total)}
                  detail={`${summary.today.orders} pedidos`}
                  icon={CircleDollarSign}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Gasto semana"
                  value={money(summary.week.total)}
                  detail={`${summary.week.orders} pedidos`}
                  icon={CircleDollarSign}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Gasto mês"
                  value={money(summary.month.total)}
                  detail={`${summary.month.orders} pedidos`}
                  icon={CircleDollarSign}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Gasto total"
                  value={money(summary.allTime.total)}
                  detail={`${summary.allTime.orders} pedidos · média ${money(summary.allTime.average)}`}
                  icon={CircleDollarSign}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <DashboardChartsPanel orders={orders} />
            </div>
          )}

          {section === "reports" && (
            <div className="max-w-3xl rounded-2xl border border-[#e8edf4] bg-white p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff3e9] text-[#e97820]">
                <FileText size={18} />
              </span>
              <h2 className="mt-4 font-bold text-[#102b55]">
                Relatório das entregas
              </h2>
              <p className="mt-1 text-sm text-[#718096]">
                Exporte os registros empresariais disponíveis na sua conta,
                incluindo valores e endereços.
              </p>
              <button
                onClick={exportCsv}
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#0c225a] px-4 py-2.5 text-sm font-bold text-white"
              >
                <Download size={15} /> Baixar CSV
              </button>
            </div>
          )}

          {section === "profile" && (
            <CompanyOrganizationPanel
              token={token}
              user={user}
              profile={profile}
              savingProfile={saving}
              onProfileChange={setProfile}
              onSaveProfile={() => void saveProfile()}
              onFeedback={handleOrganizationFeedback}
            />
          )}
        </section>
      </main>
    </div>
  )
}
