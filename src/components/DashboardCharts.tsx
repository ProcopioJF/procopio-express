import { useMemo } from "react"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ApiCompany, ApiOrder } from "../services/api"

const COLORS = [
  "#f47b20",
  "#0c225a",
  "#38bdf8",
  "#8b5cf6",
  "#10b981",
  "#94a3b8",
]

const money = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`

function ChartCard({
  title,
  detail,
  children,
}: {
  title: string
  detail?: string
  children: React.ReactNode
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#e8edf4] bg-white p-5 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-[#102b55]">{title}</h3>
        {detail && (
          <span className="text-[10px] font-medium text-[#94a3b8]">
            {detail}
          </span>
        )}
      </div>
      {children}
    </article>
  )
}

export default function DashboardCharts({
  orders,

  companies = [],

  audience = "company",
}: {
  orders: ApiOrder[]

  companies?: ApiCompany[]

  audience?: "company" | "admin"
}) {
  const data = useMemo(() => {
    const today = new Date()

    const dayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )

    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(dayStart)

      date.setDate(dayStart.getDate() - (6 - index))

      return {
        date,

        label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
          .format(date)
          .replace(".", ""),

        orders: 0,

        total: 0,
      }
    })

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        today.getFullYear(),
        today.getMonth() - (5 - index),
        1,
      )

      return {
        year: date.getFullYear(),

        month: date.getMonth(),

        label: new Intl.DateTimeFormat("pt-BR", { month: "short" })
          .format(date)
          .replace(".", ""),

        orders: 0,

        total: 0,
      }
    })

    const hours = Array.from({ length: 12 }, (_, index) => ({
      hour: index + 8,
      label: `${index + 8}h`,
      orders: 0,
    }))

    const neighborhoods = new Map<string, number>()

    const companyCounts = new Map<string, number>()

    orders.forEach((order) => {
      const created = new Date(order.createdAt)

      if (Number.isNaN(created.getTime())) return

      const price = Number(order.price) || 0

      const day = recentDays.find(
        ({ date }) => date.toDateString() === created.toDateString(),
      )

      if (day) {
        day.orders += 1

        day.total += price
      }

      const month = months.find(
        (item) =>
          item.year === created.getFullYear() &&
          item.month === created.getMonth(),
      )

      if (month) {
        month.orders += 1

        month.total += price
      }

      if (
        created.toDateString() === today.toDateString() &&
        created.getHours() >= 8 &&
        created.getHours() <= 19
      ) {
        hours[created.getHours() - 8].orders += 1
      }

      const neighborhood = order.deliveryNeighborhood?.trim() || "Não informado"

      neighborhoods.set(
        neighborhood,
        (neighborhoods.get(neighborhood) ?? 0) + 1,
      )

      if (order.companyId)
        companyCounts.set(
          order.companyId,
          (companyCounts.get(order.companyId) ?? 0) + 1,
        )
    })

    const sortedNeighborhoods = [...neighborhoods.entries()].sort(
      (a, b) => b[1] - a[1],
    )

    const topNeighborhoods = sortedNeighborhoods
      .slice(0, 4)
      .map(([name, value]) => ({ name, value }))

    const otherNeighborhoods = sortedNeighborhoods
      .slice(4)
      .reduce((total, [, value]) => total + value, 0)

    if (otherNeighborhoods)
      topNeighborhoods.push({ name: "Outros", value: otherNeighborhoods })

    const companyNames = new Map(
      companies.map((company) => [company.id, company.name]),
    )

    const companyVolume = [...companyCounts.entries()]

      .map(([id, count]) => ({
        name: companyNames.get(id) ?? "Empresa",
        orders: count,
      }))

      .sort((a, b) => b.orders - a.orders)

      .slice(0, 5)

    const previousMonth = months.at(-2)

    const currentMonth = months.at(-1)

    return {
      recentDays: recentDays.map(({ label, orders: count, total }) => ({
        name: label,
        orders: count,
        total,
      })),

      months: months.map(({ label, orders: count, total }) => ({
        name: label,
        orders: count,
        total,
      })),

      hours,

      neighborhoods: topNeighborhoods,

      companyVolume,

      monthlyComparison: months.map(({ label, orders: count }, index) => ({
        name: label,

        atual: count,

        anterior: index > 0 ? months[index - 1].orders : 0,
      })),

      peakNeighborhood: sortedNeighborhoods[0]?.[0] ?? "—",

      peakHour: hours.reduce(
        (peak, hour) => (hour.orders > peak.orders ? hour : peak),
        hours[0],
      ),

      previousMonthOrders: previousMonth?.orders ?? 0,

      currentMonthOrders: currentMonth?.orders ?? 0,
    }
  }, [companies, orders])

  const chartAxis = {
    fontSize: 10,
    fill: "#94a3b8",
    tickLine: false,
    axisLine: false,
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Entregas por dia" detail="Últimos 7 dias">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={data.recentDays}
              margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="deliveryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f47b20" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#f47b20" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis allowDecimals={false} tick={chartAxis} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="orders"
                name="Entregas"
                stroke="#f47b20"
                strokeWidth={2.5}
                fill="url(#deliveryFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gastos por período" detail="Até 100 pedidos recentes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.months}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis tick={chartAxis} />
              <Tooltip formatter={(value) => money(Number(value ?? 0))} />
              <Bar
                dataKey="total"
                name="Gasto"
                fill="#f47b20"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={
            audience === "admin" ? "Volume por empresa" : "Volume por bairro"
          }
          detail="Registros recentes"
        >
          {audience === "admin" && data.companyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.companyVolume}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 12, bottom: 0 }}
              >
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={chartAxis} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ ...chartAxis, fontSize: 9 }}
                />
                <Tooltip />
                <Bar
                  dataKey="orders"
                  name="Entregas"
                  fill="#0c225a"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : data.neighborhoods.length > 0 ? (
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="58%" height={220}>
                <PieChart>
                  <Pie
                    data={data.neighborhoods}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {data.neighborhoods.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="min-w-0 space-y-2">
                {data.neighborhoods.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 text-[10px] text-[#64748b]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Volume por horário" detail="Pedidos registrados hoje">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.hours}
              margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
            >
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tick={chartAxis} interval={2} />
              <YAxis allowDecimals={false} tick={chartAxis} />
              <Tooltip />
              <Bar
                dataKey="orders"
                name="Entregas"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Comparação mensal"
          detail="Pedidos carregados · janela de 6 meses"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data.monthlyComparison}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis allowDecimals={false} tick={chartAxis} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="atual"
                name="Mês atual"
                stroke="#0c225a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="anterior"
                name="Mês anterior"
                stroke="#f47b20"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight
          label="Bairro mais atendido"
          value={data.peakNeighborhood}
          detail="Nos registros recentes"
        />
        <Insight
          label="Horário de pico"
          value={data.peakHour.orders ? data.peakHour.label : "—"}
          detail="Pedidos de hoje"
        />
        <Insight
          label="Entregas neste mês"
          value={`${data.currentMonthOrders}`}
          detail="Nos últimos registros carregados"
        />
        <Insight
          label="Comparativo mensal"
          value={
            data.previousMonthOrders
              ? `${Math.round((data.currentMonthOrders / data.previousMonthOrders - 1) * 100)}%`
              : "—"
          }
          detail="Variação vs. mês anterior"
        />
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="grid h-[220px] place-items-center text-center text-xs text-[#94a3b8]">
      Os gráficos serão preenchidos conforme novos pedidos forem registrados.
    </div>
  )
}

function Insight({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="rounded-2xl border border-[#e8edf4] bg-white p-4 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        {label}
      </p>
      <strong className="mt-2 block truncate text-base font-extrabold text-[#102b55]">
        {value}
      </strong>
      <span className="mt-1 block text-[10px] text-[#94a3b8]">{detail}</span>
    </article>
  )
}
