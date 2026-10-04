import { lazy, Suspense } from "react"

import type { ApiDashboardCharts } from "../services/api"

const DashboardCharts = lazy(() => import("./DashboardCharts"))

export default function DashboardChartsPanel({
  data,
  audience,
}: {
  data: ApiDashboardCharts
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
        data={data}
        audience={audience}
      />
    </Suspense>
  )
}
