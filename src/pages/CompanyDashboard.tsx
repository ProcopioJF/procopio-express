import { useCallback, useEffect, useState } from "react"

import {
  BarChart3,
  Building2,
  CircleDollarSign,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react"

import DashboardChartsPanel from "../components/DashboardChartsPanel"

import IntelligencePanel from "../components/IntelligencePanel"

import CompanyOrganizationPanel from "../components/CompanyOrganizationPanel"

import Logo from "../components/Logo"

import {
  formatOrderPrice,
  ORDER_STATUS_LABELS,
  getDashboardCharts,
  getCompanySettings,
  getDashboardSummary,
  getPanelOrders,
  saveCompanySettings,
  type ApiCompanySettings,
  type ApiDashboardSummary,
  type ApiDashboardCharts,
  type ApiOrder,
  type ApiUser,
} from "../services/api"

type Section = "overview" | "orders" | "intelligence" | "finance" | "reports" | "profile"

const NAV: Array<{
  id: Section
  label: string
  icon: typeof LayoutDashboard
}> = [
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

const EMPTY_CHARTS: ApiDashboardCharts = {
  recentDays: [],
  months: [],
  hours: [],
  neighborhoods: [],
  companyVolume: [],
  peakNeighborhood: "—",
  peakHour: { hour: 8, label: "8h", orders: 0 },
  previousMonthOrders: 0,
  currentMonthOrders: 0,
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
    <>
    <div className="hidden overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white md:block">
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
                {[order.branch?.name, order.costCenter?.name]
                  .filter(Boolean)
                  .join(" · ") || "Sede / não informado"}
              </td>
              <td className="px-4 py-3 font-bold text-[#102b55]">
                {formatOrderPrice(order)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-bold ${
                    order.status === "CANCELLED"
                      ? "bg-red-50 text-red-700"
                      : order.status === "DELIVERED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status]}
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
    <div className="grid gap-3 md:hidden">
      {orders.map((order) => (
        <article
          key={order.id}
          className="rounded-2xl border border-[#e5eaf0] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-[#0f3266]">
                Pedido #{order.publicId}
              </p>
              <p className="mt-1 text-[11px] text-[#64748b]">
                {new Date(order.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                order.status === "CANCELLED"
                  ? "bg-red-50 text-red-700"
                  : order.status === "DELIVERED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <div className="mt-3 space-y-2 border-t border-[#eef2f6] pt-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-[#64748b]">Solicitante</span>
              <span className="text-right font-semibold text-[#102a43]">
                {order.requesterName || order.recipientName}
                <small className="mt-0.5 block text-[10px] font-normal text-[#64748b]">
                  {order.requesterPhone || order.recipientPhone || "—"}
                </small>
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-[#64748b]">Destinatário</span>
              <span className="text-right font-semibold text-[#102a43]">
                {order.recipientName}
                <small className="mt-0.5 block text-[10px] font-normal text-[#64748b]">
                  {order.recipientPhone || "—"}
                </small>
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-[#64748b]">Origem</span>
              <span className="break-words text-right text-[#334155]">
                {address(order.pickupStreet, order.pickupNumber, order.pickupNeighborhood)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-[#64748b]">Destino</span>
              <span className="break-words text-right text-[#334155]">
                {address(order.deliveryStreet, order.deliveryNumber, order.deliveryNeighborhood)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eef2f6] pt-3">
            <span className="truncate text-[11px] text-[#64748b]">
              {[order.branch?.name, order.costCenter?.name]
                .filter(Boolean)
                .join(" · ") || "Sede / não informado"}
            </span>
            <strong className="shrink-0 text-sm text-[#0f3266]">
              {formatOrderPrice(order)}
            </strong>
          </div>
        </article>
      ))}
      {orders.length === 0 && (
        <p className="rounded-2xl border border-[#e5eaf0] bg-white p-8 text-center text-sm text-[#7b8ba1]">
          Ainda não há entregas registradas para esta empresa.
        </p>
      )}
    </div>
    </>
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [orders, setOrders] = useState<ApiOrder[]>([])

  const [summary, setSummary] = useState(EMPTY_SUMMARY)

  const [charts, setCharts] = useState(EMPTY_CHARTS)

  const [profile, setProfile] = useState(EMPTY_PROFILE)

  const [search, setSearch] = useState("")

  const [orderFilter, setOrderFilter] = useState<"all" | "completed">("all")

  const [orderFrom, setOrderFrom] = useState("")

  const [orderTo, setOrderTo] = useState("")

  const [orderPage, setOrderPage] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  })

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      const [orderResult, summaryResult, chartsResult, profileResult] =
        await Promise.all([
          getPanelOrders(token, "company", { page: 1, pageSize: 25 }),

          getDashboardSummary(token),

          getDashboardCharts(token),

          getCompanySettings(token),
        ])

      setOrders(orderResult.orders)

      if (orderResult.pagination) setOrderPage(orderResult.pagination)

      setSummary(summaryResult.summary)

      setCharts(chartsResult.charts)

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

  const filteredOrders = orders

  const loadOrderPage = async (page: number) => {
    setLoading(true)
    setError("")
    try {
      const result = await getPanelOrders(token, "company", {
        page,
        pageSize: 25,
        search: search.trim(),
        status: orderFilter === "completed" ? "COMPLETED" : undefined,
        from: orderFrom || undefined,
        to: orderTo || undefined,
      })
      setOrders(result.orders)
      if (result.pagination) setOrderPage(result.pagination)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as entregas.",
      )
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = async () => {
    setError("")
    try {
      const query = {
        pageSize: 100,
        search: search.trim(),
        status: orderFilter === "completed" ? "COMPLETED" as const : undefined,
        from: orderFrom || undefined,
        to: orderTo || undefined,
      }
      const firstPage = await getPanelOrders(token, "company", {
        ...query,
        page: 1,
      })
      const exportRows = [...firstPage.orders]
      for (
        let page = 2;
        page <= (firstPage.pagination?.totalPages ?? 1);
        page += 1
      ) {
        const result = await getPanelOrders(token, "company", {
          ...query,
          page,
        })
        exportRows.push(...result.orders)
      }
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

        ...exportRows.map((order) => [
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
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(";"),
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível exportar os registros.",
      )
    }
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

  const handleOrganizationFeedback = useCallback(
    (message: string, success = "") => {
      setError(message)
      setNotice(success)
    },
    [],
  )

  const title = NAV.find((item) => item.id === section)?.label ?? "Visão Geral"

  const companyName = profile.name || user.name

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[#f5f7fb] text-[#1a2b43] md:h-screen">
      {mobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-slate-950/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-30 flex w-[252px] shrink-0 flex-col border-r border-[#e8edf4] bg-white transition-transform md:static md:z-auto md:translate-x-0 md:transition-[width] ${
          sidebarOpen ? "md:w-[252px]" : "md:w-[76px]"
        }`}
      >
        <div
          className={`flex h-[74px] items-center justify-between border-b border-[#edf1f6] px-5 ${
            sidebarOpen ? "" : "md:justify-center md:px-3"
          }`}
        >
          <Logo
            variant="horizontal"
            className={`h-8 max-w-[172px] object-contain object-left ${
              sidebarOpen ? "" : "md:hidden"
            }`}
          />
          {!sidebarOpen && (
            <Logo
              variant="icon"
              className="hidden h-9 w-9 object-contain md:block"
            />
          )}
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu lateral"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#718096] hover:bg-[#f5f7fb] md:hidden"
          >
            <X size={17} />
          </button>
        </div>
        <div
          className={`mx-4 mt-4 rounded-xl border border-[#e8edf4] bg-[#f8fafc] px-3 py-2.5 ${
            sidebarOpen ? "" : "md:hidden"
          }`}
        >
          <b className="block truncate text-[11px] text-[#102b55]">
            {companyName}
          </b>
          <small className="mt-1 block text-[10px] text-[#8795a8]">
            Plano empresarial
          </small>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              onClick={() => {
                setSection(id)
                setMobileMenuOpen(false)
              }}
              aria-current={section === id ? "page" : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-200 ${
                section === id
                  ? "bg-[#effaff] text-[#0f3266] shadow-[inset_3px_0_0_#ff7a18]"
                  : "text-[#52657f] hover:bg-[#f7f9fc] hover:text-[#0f3266]"
              } ${sidebarOpen ? "" : "justify-center"}`}
            >
              <Icon size={17} />
              <span className={sidebarOpen ? "" : "md:hidden"}>{label}</span>
            </button>
          ))}
        </nav>
        <div
          className={`mx-4 mb-3 flex items-center gap-2.5 rounded-xl bg-[#f8fafc] p-3 ${
            sidebarOpen ? "" : "md:hidden"
          }`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffead8] text-xs font-bold text-[#c76216]">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-xs text-[#102b55]">{user.name}</b>
            <small className="text-[10px] text-[#8795a8]">
              Gestor empresarial
            </small>
          </div>
        </div>
        <div className="border-t border-[#edf1f6] p-3">
          <button
            onClick={onLogout}
            title="Sair"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718096] hover:bg-[#fff4ef] hover:text-[#c76216] ${
              sidebarOpen ? "" : "justify-center"
            }`}
          >
            <LogOut size={16} />
            <span className={sidebarOpen ? "" : "md:hidden"}>Sair</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-[74px] items-center justify-between gap-2 border-b border-[#e8edf4] bg-white/95 px-3 py-3 backdrop-blur sm:gap-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu lateral"
              aria-expanded={mobileMenuOpen}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#e8edf4] text-[#718096] md:hidden"
            >
              <Menu size={17} />
            </button>
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label={
                sidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"
              }
              aria-expanded={sidebarOpen}
              className="hidden h-9 w-9 place-items-center rounded-xl border border-[#e8edf4] text-[#718096] hover:bg-[#f8fafc] md:grid"
            >
              {sidebarOpen ? (
                <PanelLeftClose size={17} />
              ) : (
                <PanelLeftOpen size={17} />
              )}
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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f47b20] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#df6d17] sm:gap-2 sm:px-4 sm:text-xs"
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Valor dos pedidos hoje"
                  value={money(summary.today.total)}
                  detail={`${summary.today.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#fff3e9] text-[#e97820]"
                />
                <MetricCard
                  label="Valor dos pedidos na semana"
                  value={money(summary.week.total)}
                  detail={`${summary.week.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#edf5ff] text-[#3778c2]"
                />
                <MetricCard
                  label="Valor dos pedidos no mês"
                  value={money(summary.month.total)}
                  detail={`${summary.month.orders} entregas`}
                  icon={CircleDollarSign}
                  tone="bg-[#eff9f2] text-[#3d9a62]"
                />
                <MetricCard
                  label="Valor registrado nos pedidos"
                  value={money(summary.allTime.total)}
                  detail="Histórico consolidado"
                  icon={CircleDollarSign}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <DashboardChartsPanel data={charts} />
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
                    Histórico completo da empresa, com filtros e paginação.
                  </p>
                </div>
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                  <div className="flex rounded-xl border border-[#e8edf4] bg-white p-1">
                    {([
                      ["all", "Todos"],
                      ["completed", "Concluídas"],
                    ] as const).map(([filter, label]) => (
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
                  <label className="relative basis-full md:hidden">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa8b8]"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar…"
                      className="h-9 w-full rounded-xl border border-[#e8edf4] bg-white pl-9 pr-3 text-xs"
                    />
                  </label>
                  <button
                    onClick={() => void exportCsv()}
                    disabled={loading}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#e8edf4] bg-white px-2.5 text-[11px] font-bold text-[#102b55] sm:gap-2 sm:px-3 sm:text-xs"
                  >
                    <Download size={14} /> Exportar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e8edf4] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_minmax(150px,220px)_auto]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Número, solicitante, destinatário ou bairro"
                  className="col-span-2 h-10 min-w-0 rounded-xl border border-[#e2e8f0] px-3 text-xs sm:col-span-1"
                />
                <label className="text-[10px] text-[#718096]">
                  De
                  <input
                    type="date"
                    value={orderFrom}
                    onChange={(event) => setOrderFrom(event.target.value)}
                    className="mt-1 block h-9 w-full rounded-lg border border-[#e2e8f0] px-2 text-xs"
                  />
                </label>
                <label className="text-[10px] text-[#718096]">
                  Até
                  <input
                    type="date"
                    value={orderTo}
                    onChange={(event) => setOrderTo(event.target.value)}
                    className="mt-1 block h-9 w-full rounded-lg border border-[#e2e8f0] px-2 text-xs"
                  />
                </label>
                <button
                  onClick={() => void loadOrderPage(1)}
                  disabled={loading}
                  className="col-span-2 h-10 self-end rounded-xl bg-[#0c225a] px-3 text-xs font-bold text-white disabled:opacity-50 sm:col-span-1"
                >
                  Aplicar filtros
                </button>
              </div>
              <p className="text-xs text-[#8795a8]">
                As solicitações do portal são consideradas concluídas quando
                finalizadas ou entregues. Registros cancelados permanecem no
                histórico e aparecem em “Todos”.
              </p>
              <OrdersTable orders={filteredOrders} />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#718096]">
                <span>
                  {orderPage.total.toLocaleString("pt-BR")} entregas encontradas
                  · página {orderPage.page} de{" "}
                  {Math.max(1, orderPage.totalPages)}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={orderPage.page <= 1 || loading}
                    onClick={() => void loadOrderPage(orderPage.page - 1)}
                    className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={orderPage.page >= orderPage.totalPages || loading}
                    onClick={() => void loadOrderPage(orderPage.page + 1)}
                    className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === "intelligence" && (
            <IntelligencePanel token={token} companyName={companyName} />
          )}

          {section === "finance" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#102b55]">Financeiro</h2>
                <p className="mt-1 text-xs text-[#8795a8]">
                  Valores informativos registrados nas solicitações da empresa.
                </p>
              </div>
              <div className="max-w-xl">
                <MetricCard
                  label="Valor total registrado nos pedidos"
                  value={money(summary.allTime.total)}
                  detail={`${summary.allTime.orders} pedidos · média de ${money(summary.allTime.average)} por pedido`}
                  icon={CircleDollarSign}
                  tone="bg-[#f1edff] text-[#785cc2]"
                />
              </div>
              <div className="max-w-3xl rounded-2xl border border-[#f1d6b8] bg-[#fffaf4] p-4 text-sm text-[#76522f]">
                Esses valores refletem os preços registrados nos pedidos; não
                confirmam pagamentos ou recebimentos e não representam saldo
                conciliado. A conciliação financeira ainda não está disponível.
              </div>
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
