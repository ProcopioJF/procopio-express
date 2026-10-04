import { useCallback, useEffect, useState } from "react"

import {
  Activity,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
  getDashboardCharts,
  getDashboardSummary,
  getPanelOrders,
  getSettings,
  saveSettings,
  updateOrderStatus,
  ORDER_STATUS_LABELS,
  type ApiCompany,
  type ApiDashboardSummary,
  type ApiDashboardCharts,
  type ApiOrder,
  type ApiPriceTable,
  type ApiSettings,
  type ApiUser,
} from "../services/api"

type Section = "overview" | "intelligence" | "companies" | "commercial" | "orders" | "finance" | "administration"

type AdminTab = "routes" | "settings" | "users" | "audit" | "integrations"

const nextAdminOrderStep: Partial<
  Record<ApiOrder["status"], { status: ApiOrder["status"]; label: string }>
> = {
  PENDING: { status: "CONFIRMED", label: "Confirmar pedido" },
  FINALIZED: { status: "CONFIRMED", label: "Confirmar pedido" },
  CONFIRMED: { status: "PICKED_UP", label: "Confirmar coleta" },
  ASSIGNED: { status: "PICKED_UP", label: "Confirmar coleta" },
  PICKED_UP: { status: "IN_TRANSIT", label: "Iniciar entrega" },
  IN_TRANSIT: { status: "DELIVERED", label: "Confirmar entrega" },
}

const NAV: Array<{
  id: Section
  label: string
  icon: typeof LayoutDashboard
}> = [
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

const EMPTY_SETTINGS: ApiSettings = {
  companyName: "Procópio Express",

  whatsappOperationsNumber: "",

  supportPhone: "",

  operationCity: "Juiz de Fora",
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

function OrderTable({
  orders,
  onAdvanceStatus,
  updatingOrderId,
}: {
  orders: ApiOrder[]
  onAdvanceStatus: (order: ApiOrder) => void
  updatingOrderId: string | null
}) {
  return (
    <>
    <div className="hidden overflow-x-auto rounded-2xl border border-[#e8edf4] bg-white md:block">
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
              "Ação",
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
                {[order.branch?.name, order.costCenter?.name]
                  .filter(Boolean)
                  .join(" · ") || "—"}
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
              <td className="px-4 py-3 text-[#64748b]">
                {order.companyId ? "Empresarial" : "Avulso"}
              </td>
              <td className="px-4 py-3">
                {nextAdminOrderStep[order.status] && (
                  <button
                    onClick={() => onAdvanceStatus(order)}
                    disabled={updatingOrderId === order.id}
                    className="whitespace-nowrap rounded-lg bg-[#0c225a] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {updatingOrderId === order.id
                      ? "Atualizando..."
                      : nextAdminOrderStep[order.status]?.label ?? "Atualizar"}
                  </button>
                )}
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
    <div className="grid gap-3 md:hidden">
      {orders.map((order) => {
        const nextStep = nextAdminOrderStep[order.status]
        return (
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
                  {new Date(order.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {order.companyId ? "Empresarial" : "Avulso"}
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
                <span className="shrink-0 text-[#64748b]">Coleta</span>
                <span className="break-words text-right text-[#334155]">
                  {address(order.pickupStreet, order.pickupNumber, order.pickupNeighborhood)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-[#64748b]">Entrega</span>
                <span className="break-words text-right text-[#334155]">
                  {address(order.deliveryStreet, order.deliveryNumber, order.deliveryNeighborhood)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eef2f6] pt-3">
              <span className="truncate text-[11px] text-[#64748b]">
                {[order.branch?.name, order.costCenter?.name]
                  .filter(Boolean)
                  .join(" · ") || "Avulso"}
              </span>
              <strong className="shrink-0 text-sm text-[#0f3266]">
                {formatOrderPrice(order)}
              </strong>
            </div>
            {nextStep && (
              <button
                onClick={() => onAdvanceStatus(order)}
                disabled={updatingOrderId === order.id}
                className="mt-3 min-h-11 w-full rounded-xl bg-[#ff7a18] px-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {updatingOrderId === order.id ? "Atualizando..." : nextStep.label}
              </button>
            )}
          </article>
        )
      })}
      {orders.length === 0 && (
        <p className="rounded-2xl border border-[#e5eaf0] bg-white p-8 text-center text-sm text-[#7b8ba1]">
          Nenhum pedido registrado neste filtro.
        </p>
      )}
    </div>
    </>
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

  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [adminTab, setAdminTab] = useState<AdminTab>("routes")

  const [orders, setOrders] = useState<ApiOrder[]>([])

  const [companies, setCompanies] = useState<ApiCompany[]>([])

  const [priceTables, setPriceTables] = useState<ApiPriceTable[]>([])

  const [summary, setSummary] = useState(EMPTY_SUMMARY)

  const [charts, setCharts] = useState(EMPTY_CHARTS)

  const [settings, setSettings] = useState(EMPTY_SETTINGS)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const [search, setSearch] = useState("")

  const [orderStatus, setOrderStatus] = useState<ApiOrder["status"] | "">("")

  const [orderFrom, setOrderFrom] = useState("")

  const [orderTo, setOrderTo] = useState("")

  const [orderCompanyId, setOrderCompanyId] = useState("")

  const [orderPagination, setOrderPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  })

  const refresh = useCallback(async () => {
    setLoading(true)

    setError("")

    try {
      const [
        orderResult,
        summaryResult,
        chartsResult,
        companyResult,
        priceTableResult,
        settingsResult,
      ] = await Promise.all([
        getPanelOrders(token, "admin"),

        getDashboardSummary(token),

        getDashboardCharts(token),

        getAdminCompanies(token),

        getAdminPriceTables(token),

        getSettings(token),
      ])

      setOrders(orderResult.orders)

      if (orderResult.pagination) setOrderPagination(orderResult.pagination)

      setSummary(summaryResult.summary)

      setCharts(chartsResult.charts)

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

  const filteredOrders = orders

  const loadOrderPage = async (page: number) => {
    setLoading(true)
    setError("")
    try {
      const result = await getPanelOrders(token, "admin", {
        page,
        pageSize: 25,
        search: search.trim(),
        status: orderStatus || undefined,
        companyId: orderCompanyId || undefined,
        from: orderFrom || undefined,
        to: orderTo || undefined,
      })
      setOrders(result.orders)
      if (result.pagination) setOrderPagination(result.pagination)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os pedidos.",
      )
    } finally {
      setLoading(false)
    }
  }

  const advanceOrderStatus = async (order: ApiOrder) => {
    const nextStep = nextAdminOrderStep[order.status]
    if (!nextStep) return
    if (
      nextStep.status === "DELIVERED" &&
      !window.confirm(`Confirmar que o pedido #${order.publicId} foi entregue?`)
    ) {
      return
    }

    setUpdatingOrderId(order.id)
    setError("")
    setNotice("")
    try {
      await updateOrderStatus(token, order.id, nextStep.status)
      setNotice(
        `Pedido #${order.publicId}: ${ORDER_STATUS_LABELS[nextStep.status]}.`,
      )
      await loadOrderPage(orderPagination.page)
      try {
        const result = await getDashboardSummary(token)
        setSummary(result.summary)
      } catch (cause) {
        setError(
          `O status foi atualizado, mas o resumo não pôde ser atualizado: ${
            cause instanceof Error ? cause.message : "erro desconhecido"
          }`,
        )
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o status do pedido.",
      )
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const title =
    NAV.find((item) => item.id === section)?.label ?? "Centro de Controle"

  const activeRoutes = priceTables.filter((table) => table.active).length

  const exportOrders = async () => {
    setError("")
    try {
      const query = {
        pageSize: 100,
        search: search.trim(),
        status: orderStatus || undefined,
        companyId: orderCompanyId || undefined,
        from: orderFrom || undefined,
        to: orderTo || undefined,
      }
      const firstPage = await getPanelOrders(token, "admin", {
        ...query,
        page: 1,
      })
      const exportRows = [...firstPage.orders]
      for (
        let page = 2;
        page <= (firstPage.pagination?.totalPages ?? 1);
        page += 1
      ) {
        const result = await getPanelOrders(token, "admin", { ...query, page })
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
          "Valor",
          "Tipo",
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

          formatOrderPrice(order),

          order.companyId ? "Empresarial" : "Avulso",
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

      link.download = "procopio-pedidos.csv"

      link.click()

      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível exportar os pedidos.",
      )
    }
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
    <div className="relative flex h-dvh overflow-hidden bg-[#f5f7fb] text-[#1a2b43] md:h-screen">
      {mobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-slate-950/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[252px] shrink-0 flex-col border-r border-[#e8edf4] bg-white transition-[transform,width] md:static md:z-auto md:h-auto md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarOpen ? "md:w-[252px]" : "md:w-[76px]"}`}
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
          className={`mx-4 mt-4 rounded-xl border border-[#f6d7bf] bg-[#fff8f1] px-3 py-2.5 ${
            sidebarOpen ? "" : "md:hidden"
          }`}
        >
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
              title={sidebarOpen ? undefined : label}
              onClick={() => {
                setSection(id)
                setMobileMenuOpen(false)
              }}
              aria-current={section === id ? "page" : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-200 ${
                section === id
                  ? "bg-[#effaff] text-[#0f3266] shadow-[inset_3px_0_0_#ff7a18]"
                  : "text-[#52657f] hover:bg-[#f7f9fc] hover:text-[#0f3266]"
              } ${sidebarOpen ? "" : "md:justify-center"}`}
            >
              <Icon size={17} />
              <span className={sidebarOpen ? "" : "md:hidden"}>{label}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-[#edf1f6] p-3">
          <div
            className={`mb-3 flex items-center gap-2.5 rounded-xl bg-[#f8fafc] p-3 ${
              sidebarOpen ? "" : "md:justify-center md:px-0"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffead8] text-[10px] font-bold text-[#c76216]">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className={`min-w-0 ${sidebarOpen ? "" : "md:hidden"}`}>
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
            title={sidebarOpen ? undefined : "Sair"}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#718096] hover:bg-[#fff4ef] hover:text-[#c76216] ${
              sidebarOpen ? "" : "md:justify-center"
            }`}
          >
            <LogOut size={16} />{" "}
            <span className={sidebarOpen ? "" : "md:hidden"}>Sair</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-[74px] items-center justify-between gap-2 border-b border-[#e8edf4] bg-white/95 px-3 py-3 backdrop-blur sm:gap-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
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
              className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#e8edf4] text-[#718096] hover:bg-[#f8fafc] md:grid"
            >
              {sidebarOpen ? (
                <PanelLeftClose size={17} />
              ) : (
                <PanelLeftOpen size={17} />
              )}
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#f47b20]">
                PAINEL ADMINISTRATIVO
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
                placeholder="Buscar pedidos..."
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
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f47b20] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#df6d17] sm:gap-2 sm:px-4 sm:text-xs"
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                data={charts}
                key="admin-dashboard-charts"
                audience="admin"
              />
            </div>
          )}

          {section === "intelligence" && (
            <IntelligencePanel
              token={token}
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
                          {company.subscription
                            ? money(Number(company.subscription.monthlyPrice))
                            : "—"}
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
                    Pesquise e filtre o histórico completo de pedidos.
                  </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button
                    onClick={() => void exportOrders()}
                    disabled={loading}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#e8edf4] bg-white px-2.5 text-[11px] font-bold text-[#102b55] sm:gap-2 sm:px-3 sm:text-xs"
                  >
                    <Download size={14} /> Exportar CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e8edf4] bg-white p-3 sm:grid-cols-2 xl:grid-cols-6">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Número, pessoa ou bairro"
                  className="col-span-2 h-10 min-w-0 rounded-xl border border-[#e2e8f0] px-3 text-xs xl:col-span-1"
                />
                <select
                  value={orderCompanyId}
                  onChange={(event) => setOrderCompanyId(event.target.value)}
                  className="h-10 min-w-0 rounded-xl border border-[#e2e8f0] bg-white px-3 text-xs"
                >
                  <option value="">Todas as empresas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <select
                  value={orderStatus}
                  onChange={(event) =>
                    setOrderStatus(
                      event.target.value as ApiOrder["status"] | "",
                    )
                  }
                  className="h-10 min-w-0 rounded-xl border border-[#e2e8f0] bg-white px-3 text-xs"
                >
                  <option value="">Todos os status</option>
                  {([
                    "PENDING",
                    "FINALIZED",
                    "CONFIRMED",
                    "ASSIGNED",
                    "PICKED_UP",
                    "IN_TRANSIT",
                    "DELIVERED",
                    "CANCELLED",
                  ] as const).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
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
                  className="col-span-2 h-10 self-end rounded-xl bg-[#0c225a] px-3 text-xs font-bold text-white disabled:opacity-50 xl:col-span-1"
                >
                  Aplicar filtros
                </button>
              </div>
              <OrderTable
                orders={filteredOrders}
                onAdvanceStatus={(order) => void advanceOrderStatus(order)}
                updatingOrderId={updatingOrderId}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#718096]">
                <span>
                  {orderPagination.total.toLocaleString("pt-BR")} pedidos
                  encontrados · página {orderPagination.page} de{" "}
                  {Math.max(1, orderPagination.totalPages)}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={orderPagination.page <= 1 || loading}
                    onClick={() => void loadOrderPage(orderPagination.page - 1)}
                    className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={
                      orderPagination.page >= orderPagination.totalPages ||
                      loading
                    }
                    onClick={() => void loadOrderPage(orderPagination.page + 1)}
                    className="rounded-lg border border-[#e8edf4] bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === "commercial" && (
            <AdminBusinessPanel
              token={token}
              mode="commercial"
              companies={companies}
            />
          )}

          {section === "finance" && (
            <AdminBusinessPanel
              token={token}
              mode="finance"
              companies={companies}
            />
          )}

          {section === "administration" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#102b55]">
                  Administração
                </h2>
                <p className="mt-1 text-xs text-[#8795a8]">
                  Gerencie acesso, auditoria, integrações, preços de rota e
                  preferências da operação.
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto border-b border-[#e8edf4]">
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
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${
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
