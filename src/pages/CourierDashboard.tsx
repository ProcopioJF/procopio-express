import { useCallback, useEffect, useState } from "react"
import { LogOut, MapPin, Package, RefreshCw } from "lucide-react"
import Logo from "../components/Logo"
import {
  getCourierOrders,
  ORDER_STATUS_LABELS,
  updateCourierOrderStatus,
  type ApiOrder,
} from "../services/api"

const formatAddress = (
  street?: string | null,
  number?: string | null,
  neighborhood?: string | null,
  city?: string | null,
) => [street, number, neighborhood, city].filter(Boolean).join(", ") || "Endereço não informado"

const nextStep: Partial<
  Record<ApiOrder["status"], { status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"; label: string }>
> = {
  ASSIGNED: { status: "PICKED_UP", label: "Confirmar coleta" },
  PICKED_UP: { status: "IN_TRANSIT", label: "Iniciar entrega" },
  IN_TRANSIT: { status: "DELIVERED", label: "Confirmar entrega" },
}

export default function CourierDashboard({
  token,
  name,
  onLogout,
}: {
  token: string
  name: string
  onLogout: () => void
}) {
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setOrders((await getCourierOrders(token)).orders)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar seus pedidos.",
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const advanceOrder = async (order: ApiOrder) => {
    const step = nextStep[order.status]
    if (!step) return

    setSavingOrderId(order.id)
    setError("")
    setNotice("")
    try {
      await updateCourierOrderStatus(token, order.id, step.status)
      setNotice(`Pedido #${order.publicId}: ${ORDER_STATUS_LABELS[step.status]}.`)
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o pedido.",
      )
    } finally {
      setSavingOrderId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc]">
      <header className="border-b border-[#e5eaf0] bg-white shadow-[0_1px_8px_rgba(16,42,67,0.04)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo variant="horizontal" className="h-9 w-auto object-contain" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold text-[#0f3266]">
                Painel do motoboy
              </h1>
              <p className="truncate text-xs text-[#718096]">{name}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Atualizar pedidos"
              className="grid h-11 w-11 place-items-center rounded-xl border border-[#e5eaf0] bg-white text-[#52657f] transition hover:border-[#b8dcf2] hover:bg-[#effaff] disabled:opacity-50"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#e5eaf0] bg-white px-3 text-xs font-bold text-[#52657f] transition hover:border-[#b8dcf2] hover:bg-[#effaff]"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
        <div>
          <h2 className="text-lg font-extrabold text-[#0f3266]">Meus pedidos</h2>
          <p className="mt-1 text-xs text-[#718096]">
            Pedidos atribuídos à sua conta. Atualize cada etapa conforme a entrega avança.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-700">
            {notice}
          </p>
        )}
        {loading && orders.length === 0 && (
          <p className="text-sm text-[#718096]">Carregando seus pedidos...</p>
        )}
        {!loading && orders.length === 0 && !error && (
          <div className="rounded-2xl border border-[#e5eaf0] bg-white p-8 text-center shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
            <Package className="mx-auto text-[#39b5ee]" size={24} />
            <p className="mt-3 text-sm font-semibold text-[#52657f]">
              Não há pedidos atribuídos a você no momento.
            </p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => {
            const step = nextStep[order.status]
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-[#e5eaf0] bg-white p-4 shadow-[0_3px_14px_rgba(15,35,65,0.04)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#64748b]">
                      Pedido #{order.publicId}
                    </p>
                    <h3 className="mt-1 text-sm font-extrabold text-[#0f3266]">
                      {order.recipientName}
                    </h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    order.status === "DELIVERED"
                      ? "bg-emerald-50 text-emerald-700"
                      : order.status === "CANCELLED"
                        ? "bg-red-50 text-red-700"
                        : "bg-[#effaff] text-[#1789bf]"
                  }`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <p className="flex gap-2 text-[#52657f]">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-[#ff7a18]" />
                    <span>
                      <b className="mb-0.5 block text-[#0f3266]">Coleta</b>
                      {formatAddress(
                        order.pickupStreet,
                        order.pickupNumber,
                        order.pickupNeighborhood,
                      )}
                    </span>
                  </p>
                  <p className="flex gap-2 text-[#52657f]">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-[#39b5ee]" />
                    <span>
                      <b className="mb-0.5 block text-[#0f3266]">Entrega</b>
                      {formatAddress(
                        order.deliveryStreet,
                        order.deliveryNumber,
                        order.deliveryNeighborhood,
                      )}
                    </span>
                  </p>
                </div>

                {step && (
                  <button
                    type="button"
                    onClick={() => void advanceOrder(order)}
                    disabled={savingOrderId !== null}
                    className="mt-4 min-h-12 w-full rounded-xl bg-[#ff7a18] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(255,122,24,0.2)] transition hover:bg-[#e7650b] active:scale-[0.99] disabled:opacity-50"
                  >
                    {savingOrderId === order.id ? "Atualizando..." : step.label}
                  </button>
                )}
              </article>
            )
          })}
        </div>
        {orders.length === 100 && (
          <p className="text-center text-xs text-[#718096]">
            Exibindo os 100 pedidos mais recentes atribuídos à sua conta.
          </p>
        )}
      </section>
    </main>
  )
}
