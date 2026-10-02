import { lazy, Suspense } from "react"

import type { ApiCompany, ApiOrder } from "../services/api"

const DashboardCharts = lazy(() => import("./DashboardCharts"))

export default function DashboardChartsPanel({
  orders,

  companies,

  audience,
}: {
  orders: ApiOrder[]

  companies?: ApiCompany[]

  audience?: "company" | "admin"
}) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-[280px] animate-pulse rounded-2xl border border-[#e8edf4] bg-white"
            />
          ))}
        </div>
      }
    >
      <DashboardCharts
        orders={orders}
        companies={companies}
        audience={audience}
      />
    </Suspense>
  )
}
