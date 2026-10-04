import { useState } from "react"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ApiDashboardCharts } from "../services/api"

const COLORS = [
  "#ff7a18",
  "#0f3266",
  "#39b5ee",
  "#17447f",
  "#16a34a",
  "#94a3b8",
]

const money = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`

type ChartSelection = "daily" | "monthlyValue" | "distribution" | "monthlyOrders" | "hourly"

function ChartCard({
  title,
  detail,
  children,
  className,
}: {
  title: string
  detail?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <article
      className={`min-w-0 rounded-2xl border border-[#e5eaf0] bg-white p-3 sm:p-5 shadow-[0_3px_14px_rgba(15,35,65,0.04)] ${className ?? ""}`}
    >
      <div className="mb-3 flex flex-col items-start justify-between gap-1.5 sm:mb-4 sm:flex-row sm:gap-3">
        <h3 className="text-sm font-bold text-[#102b55]">{title}</h3>
        {detail && (
          <span className="text-[10px] font-medium leading-tight text-[#718096] sm:text-right">
            {detail}
          </span>
        )}
      </div>
      {children}
    </article>
  )
}

export default function DashboardCharts({
  data,
  audience = "company",
}: {
  data: ApiDashboardCharts
  audience?: "company" | "admin"
}) {
  const [selectedChart, setSelectedChart] = useState<ChartSelection>("daily")
  const chartAxis = {
    fontSize: 10,
    fill: "#64748b",
    tickLine: false,
    axisLine: false,
  }
  const tooltipStyle = {
    contentStyle: {
      border: "1px solid #e5eaf0",
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(16, 42, 67, 0.12)",
      fontSize: 12,
      padding: "8px 12px",
    },
    labelStyle: { color: "#102a43", fontWeight: 700, marginBottom: 4 },
    itemStyle: { color: "#52657f", fontWeight: 500 },
    cursor: { fill: "rgba(57, 181, 238, 0.08)" },
  }

  return (
    <div className="space-y-4">
      <label className="block md:hidden">
        <span className="mb-1.5 block text-xs font-semibold text-[#718096]">
          Gráfico para exibir
        </span>
        <select
          aria-label="Selecionar gráfico do painel"
          value={selectedChart}
          onChange={(event) =>
            setSelectedChart(event.target.value as ChartSelection)
          }
          className="h-11 w-full rounded-xl border border-[#e5eaf0] bg-white px-3 text-sm font-semibold text-[#102a43] outline-none focus:border-[#39b5ee]"
        >
          <option value="daily">Entregas por dia</option>
          <option value="monthlyValue">Valores registrados por mês</option>
          <option value="distribution">
            {audience === "admin" ? "Volume por empresa" : "Volume por bairro"}
          </option>
          <option value="monthlyOrders">Pedidos por mês</option>
          <option value="hourly">Volume por horário</option>
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Entregas por dia"
          detail="Últimos 7 dias"
          className={selectedChart === "daily" ? "" : "hidden md:block"}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={data.recentDays}
              margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="deliveryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff7a18" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#ff7a18" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e9eff5" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis allowDecimals={false} tick={chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="orders"
                name="Entregas"
                stroke="#ff7a18"
                strokeWidth={2.5}
                fill="url(#deliveryFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Valores registrados por mês"
          detail="Todo o histórico · últimos 6 meses"
          className={selectedChart === "monthlyValue" ? "" : "hidden md:block"}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.months}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
              <CartesianGrid stroke="#e9eff5" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis tick={chartAxis} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value) => money(Number(value ?? 0))}
              />
              <Bar
                dataKey="total"
                name="Valor registrado"
                fill="#ff7a18"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={
            audience === "admin" ? "Volume por empresa" : "Volume por bairro"
          }
          detail="Todo o histórico"
          className={selectedChart === "distribution" ? "" : "hidden md:block"}
        >
          {audience === "admin" && data.companyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.companyVolume}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 12, bottom: 0 }}
              >
                <CartesianGrid stroke="#e9eff5" horizontal={false} />
                <XAxis type="number" tick={chartAxis} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ ...chartAxis, fontSize: 9 }}
                />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="orders"
                  name="Entregas"
                  fill="#0f3266"
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
                    innerRadius={46}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {data.neighborhoods.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
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

        <ChartCard
          title="Pedidos por mês"
          detail="Todo o histórico · últimos 6 meses"
          className={selectedChart === "monthlyOrders" ? "" : "hidden md:block"}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data.months}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid stroke="#e9eff5" vertical={false} />
              <XAxis dataKey="name" tick={chartAxis} />
              <YAxis allowDecimals={false} tick={chartAxis} />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey="orders"
                name="Pedidos"
                stroke="#0f3266"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Volume por horário"
        detail="Pedidos registrados hoje"
        className={selectedChart === "hourly" ? "" : "hidden md:block"}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data.hours}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid stroke="#e9eff5" vertical={false} />
            <XAxis dataKey="label" tick={chartAxis} interval={0} />
            <YAxis allowDecimals={false} tick={chartAxis} />
            <Tooltip {...tooltipStyle} />
            <Bar
              dataKey="orders"
              name="Entregas"
              fill="#39b5ee"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight
          label="Bairro mais atendido"
          value={data.peakNeighborhood}
          detail="Todo o histórico"
        />
        <Insight
          label="Horário de pico"
          value={data.peakHour.orders ? data.peakHour.label : "—"}
          detail="Pedidos de hoje"
        />
        <Insight
          label="Entregas neste mês"
          value={`${data.currentMonthOrders}`}
          detail="Mês atual · todo o histórico"
        />
        <Insight
          label="Comparativo mensal"
          value={
            data.previousMonthOrders
              ? `${Math.round((data.currentMonthOrders / data.previousMonthOrders - 1) * 100)}%`
              : "—"
          }
          detail="Pedidos no mês anterior"
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
    <article className="rounded-2xl border border-[#e5eaf0] bg-white p-3 sm:p-4 shadow-[0_3px_14px_rgba(15,35,65,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
        {label}
      </p>
      <strong className="mt-2 block truncate text-base font-extrabold text-[#0f3266]">
        {value}
      </strong>
      <span className="mt-1 block text-[10px] leading-snug text-[#718096]">{detail}</span>
    </article>
  )
}
