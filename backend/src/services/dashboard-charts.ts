import { Prisma } from "@prisma/client"

import { prisma } from "../db.js"

type CountRow = { bucket: string; orders: bigint | number }
type MonthRow = CountRow & { total: number | null }
type HourRow = { hour: number; orders: bigint | number }
type NameCountRow = { name: string; orders: bigint | number }

function saoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  }
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number)

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "")
}

export async function getDashboardCharts(companyId?: string) {
  const now = new Date()
  const { year, month, day } = saoPauloParts(now)
  const todayStart = new Date(Date.UTC(year, month - 1, day, 3))
  const weekStart = new Date(todayStart)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekday + 6) % 7))

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayStart)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
  })
  const dayRangeStart = new Date(`${days[0]}T03:00:00.000Z`)
  const monthRangeStart = new Date(`${monthKeys[0]}-01T03:00:00.000Z`)
  const scope = companyId
    ? Prisma.sql`AND "companyId" = ${companyId}`
    : Prisma.empty

  const [dayRows, monthRows, hourRows, neighborhoodRows, companyRows] =
    await Promise.all([
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS bucket,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE "createdAt" >= ${dayRangeStart} AND "createdAt" <= ${now} ${scope}
        GROUP BY bucket
      `),
      prisma.$queryRaw<MonthRow[]>(Prisma.sql`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS bucket,
               COUNT(*)::int AS orders,
               COALESCE(SUM(price), 0)::double precision AS total
        FROM "Order"
        WHERE "createdAt" >= ${monthRangeStart} AND "createdAt" <= ${now} ${scope}
        GROUP BY bucket
      `),
      prisma.$queryRaw<HourRow[]>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE "createdAt" >= ${todayStart} AND "createdAt" <= ${now} ${scope}
        GROUP BY hour
      `),
      prisma.$queryRaw<NameCountRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(TRIM("deliveryNeighborhood"), ''), 'Não informado') AS name,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE TRUE ${scope}
        GROUP BY name
        ORDER BY orders DESC, name ASC
      `),
      companyId
        ? Promise.resolve([])
        : prisma.$queryRaw<NameCountRow[]>(Prisma.sql`
            SELECT c.name AS name, COUNT(*)::int AS orders
            FROM "Order" o
            JOIN "Company" c ON c.id = o."companyId"
            GROUP BY c.name
            ORDER BY orders DESC, name ASC
            LIMIT 5
          `),
    ])

  const daysByKey = new Map(dayRows.map((row) => [row.bucket, Number(row.orders)]))
  const monthsByKey = new Map(monthRows.map((row) => [row.bucket, row]))
  const hoursByValue = new Map(hourRows.map((row) => [Number(row.hour), Number(row.orders)]))
  const monthlyData = monthKeys.map((key) => {
    const row = monthsByKey.get(key)
    return {
      name: monthLabel(key),
      orders: Number(row?.orders ?? 0),
      total: Number(row?.total ?? 0),
    }
  })
  const sortedNeighborhoods = neighborhoodRows
    .map((row) => ({ name: row.name, value: Number(row.orders) }))
    .sort((a, b) => b.value - a.value)
  const neighborhoodData = sortedNeighborhoods.slice(0, 4)
  const otherNeighborhoodOrders = sortedNeighborhoods
    .slice(4)
    .reduce((sum, row) => sum + row.value, 0)
  if (otherNeighborhoodOrders > 0) {
    neighborhoodData.push({ name: "Outros", value: otherNeighborhoodOrders })
  }
  const hourData = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 8
    return { hour, label: `${hour}h`, orders: hoursByValue.get(hour) ?? 0 }
  })
  const peakHour = hourData.reduce(
    (peak, entry) => (entry.orders > peak.orders ? entry : peak),
    hourData[0],
  )
  const topNeighborhood = sortedNeighborhoods[0]?.name ?? "—"

  return {
    recentDays: days.map((key) => ({
      name: new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        timeZone: "UTC",
      })
        .format(new Date(`${key}T12:00:00.000Z`))
        .replace(".", ""),
      orders: daysByKey.get(key) ?? 0,
    })),
    months: monthlyData,
    hours: hourData,
    neighborhoods: neighborhoodData,
    companyVolume: companyRows.map((row) => ({
      name: row.name,
      orders: Number(row.orders),
    })),
    peakNeighborhood: topNeighborhood,
    peakHour,
    previousMonthOrders: monthlyData.at(-2)?.orders ?? 0,
    currentMonthOrders: monthlyData.at(-1)?.orders ?? 0,
  }
}
