import { Prisma } from "@prisma/client"

import { prisma } from "../db.js"

type NamedCount = {
  name: string
  count: number
}

type NeighborhoodValue = {
  name: string
  pricedOrders: number
  averagePrice: number
}

type MonthlyCount = {
  month: string
  orders: number
  recordedValue: number
}

export type IntelligenceMetrics = {
  scope: "operation" | "company"

  ordersAnalyzed: number

  cancelledOrders: number

  ordersWithRecordedPrice: number

  ordersWithoutRecordedPrice: number

  totalRecordedValue: number

  averageRecordedPrice: number

  ordersWithDistance: number

  ordersWithoutDistance: number

  totalDistanceKm: number

  averageDistanceKm: number

  topPickupNeighborhood: NamedCount | null

  topDeliveryNeighborhood: NamedCount | null

  highestAveragePriceNeighborhood: NeighborhoodValue | null

  topRequesterThisMonth: NamedCount | null

  topCompanyThisMonth: NamedCount | null

  topCompanyAllTime: NamedCount | null

  peakOrderCreationHour: {
    hour: number
    count: number
  } | null

  monthlyOrders: MonthlyCount[]
}

type MonthlyRow = {
  month: string

  orders: number

  recordedValue: number | null
}

type HourRow = {
  hour: number
  count: number
}

type IntelligenceActor = {
  role: "ADMIN" | "COMPANY" | "COURIER"
  companyId?: string
}

export function resolveIntelligenceScope(actor?: IntelligenceActor) {
  if (actor?.role === "ADMIN") {
    return { allowed: true as const, companyId: undefined }
  }
  if (actor?.role === "COMPANY" && actor.companyId) {
    return { allowed: true as const, companyId: actor.companyId }
  }
  return { allowed: false as const }
}

function monthStartInSaoPaulo(date: Date, offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",

    year: "numeric",

    month: "2-digit",
  }).formatToParts(date)

  const year = Number(parts.find((part) => part.type === "year")?.value)

  const month = Number(parts.find((part) => part.type === "month")?.value)

  return new Date(Date.UTC(year, month - 1 + offset, 1, 3))
}

export async function getIntelligenceMetrics(
  companyId?: string,
): Promise<IntelligenceMetrics> {
  const now = new Date()

  const where: Prisma.OrderWhereInput = companyId ? { companyId } : {}

  const currentMonthStart = monthStartInSaoPaulo(now)

  const firstMonthStart = monthStartInSaoPaulo(now, -5)

  const currentMonthWhere: Prisma.OrderWhereInput = {
    ...where,

    createdAt: { gte: currentMonthStart, lte: now },
  }

  const sqlScope = companyId
    ? Prisma.sql`AND "companyId" = ${companyId}`
    : Prisma.empty

  const [
    aggregate,

    statuses,

    pickupGroups,

    deliveryGroups,

    valuedNeighborhoodGroups,

    requesterGroups,

    companyGroups,

    companyGroupsAllTime,

    monthlyRows,

    hourRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where,

      _count: { _all: true, price: true, distance: true },

      _sum: { price: true, distance: true },

      _avg: { price: true, distance: true },
    }),

    prisma.order.groupBy({
      by: ["status"],

      where,

      _count: { status: true },
    }),

    prisma.order.groupBy({
      by: ["pickupNeighborhood"],

      where: { ...where, pickupNeighborhood: { not: null } },

      _count: { pickupNeighborhood: true },
    }),

    prisma.order.groupBy({
      by: ["deliveryNeighborhood"],

      where: { ...where, deliveryNeighborhood: { not: null } },

      _count: { deliveryNeighborhood: true },
    }),

    prisma.order.groupBy({
      by: ["deliveryNeighborhood"],

      where: {
        ...where,

        deliveryNeighborhood: { not: null },

        price: { not: null },
      },

      _count: { _all: true, price: true },

      _avg: { price: true },
    }),

    companyId
      ? prisma.order.groupBy({
          by: ["requesterName"],

          where: { ...currentMonthWhere, requesterName: { not: null } },

          _count: { requesterName: true },
        })
      : Promise.resolve([]),

    prisma.order.groupBy({
      by: ["companyId"],

      where: { ...currentMonthWhere, companyId: { not: null } },

      _count: { companyId: true },
    }),

    prisma.order.groupBy({
      by: ["companyId"],

      where: { ...where, companyId: { not: null } },

      _count: { companyId: true },
    }),

    prisma.$queryRaw<MonthlyRow[]>`
      SELECT
        to_char(date_trunc('month', "createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS month,
        COUNT(*)::int AS orders,
        COALESCE(SUM(price), 0)::float8 AS "recordedValue"
      FROM "Order"
      WHERE "createdAt" >= ${firstMonthStart} ${sqlScope}
      GROUP BY 1
      ORDER BY 1
    `,

    prisma.$queryRaw<HourRow[]>`
      SELECT
        EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
        COUNT(*)::int AS count
      FROM "Order"
      WHERE TRUE ${sqlScope}
      GROUP BY 1
      ORDER BY count DESC, hour ASC
      LIMIT 1
    `,
  ])

  const companyIds = [...companyGroups, ...companyGroupsAllTime]

    .map((entry) => entry.companyId)

    .filter((id): id is string => id !== null)

  const uniqueCompanyIds = [...new Set(companyIds)]

  const companies = uniqueCompanyIds.length
    ? await prisma.company.findMany({
        where: { id: { in: uniqueCompanyIds } },

        select: { id: true, name: true },
      })
    : []

  const companyNames = new Map(
    companies.map((company) => [company.id, company.name]),
  )

  const toNamedCount = (
    name: string | null,

    count: number,
  ): NamedCount | null => (name?.trim() ? { name: name.trim(), count } : null)

  const topByCount = (items: Array<NamedCount | null>) =>
    items

      .filter((item): item is NamedCount => item !== null)

      .sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"),
      )[0] ?? null

  const topPickupNeighborhood = topByCount(
    pickupGroups.map((entry) =>
      toNamedCount(entry.pickupNeighborhood, entry._count.pickupNeighborhood),
    ),
  )

  const topDeliveryNeighborhood = topByCount(
    deliveryGroups.map((entry) =>
      toNamedCount(
        entry.deliveryNeighborhood,
        entry._count.deliveryNeighborhood,
      ),
    ),
  )

  const highestAveragePriceNeighborhood =
    valuedNeighborhoodGroups

      .map((entry) => ({
        name: entry.deliveryNeighborhood?.trim() ?? "",
        pricedOrders: entry._count.price,
        averagePrice: Number(entry._avg.price ?? 0),
      }))

      .filter((entry) => entry.name && entry.pricedOrders > 0)

      .sort(
        (a, b) =>
          b.averagePrice - a.averagePrice ||
          b.pricedOrders - a.pricedOrders ||
          a.name.localeCompare(b.name, "pt-BR"),
      )[0] ?? null

  const topRequesterThisMonth = topByCount(
    requesterGroups.map((entry) =>
      toNamedCount(entry.requesterName, entry._count.requesterName),
    ),
  )

  const topCompanyThisMonth = topByCount(
    companyGroups.map((entry) =>
      toNamedCount(
        entry.companyId ? (companyNames.get(entry.companyId) ?? null) : null,

        entry._count.companyId,
      ),
    ),
  )

  const topCompanyAllTime = topByCount(
    companyGroupsAllTime.map((entry) =>
      toNamedCount(
        entry.companyId ? (companyNames.get(entry.companyId) ?? null) : null,

        entry._count.companyId,
      ),
    ),
  )

  const statusCounts = new Map(
    statuses.map((entry) => [entry.status, entry._count.status]),
  )

  const ordersAnalyzed = aggregate._count._all

  const ordersWithRecordedPrice = aggregate._count.price

  const ordersWithDistance = aggregate._count.distance

  return {
    scope: companyId ? "company" : "operation",

    ordersAnalyzed,

    cancelledOrders: statusCounts.get("CANCELLED") ?? 0,

    ordersWithRecordedPrice,

    ordersWithoutRecordedPrice: ordersAnalyzed - ordersWithRecordedPrice,

    totalRecordedValue: Number(aggregate._sum.price ?? 0),

    averageRecordedPrice: Number(aggregate._avg.price ?? 0),

    ordersWithDistance,

    ordersWithoutDistance: ordersAnalyzed - ordersWithDistance,

    totalDistanceKm: Number(aggregate._sum.distance ?? 0),

    averageDistanceKm: Number(aggregate._avg.distance ?? 0),

    topPickupNeighborhood,

    topDeliveryNeighborhood,

    highestAveragePriceNeighborhood,

    topRequesterThisMonth,

    topCompanyThisMonth,

    topCompanyAllTime,

    peakOrderCreationHour: hourRows[0] ?? null,

    monthlyOrders: monthlyRows.map((entry) => ({
      month: entry.month,

      orders: entry.orders,

      recordedValue: Number(entry.recordedValue ?? 0),
    })),
  }
}

function normalizeQuestion(question: string) {
  return question

    .normalize("NFD")

    .replace(/\p{Diacritic}/gu, "")

    .toLocaleLowerCase("pt-BR")
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",

    year: "numeric",

    timeZone: "UTC",
  })

    .format(new Date(Date.UTC(year, monthNumber - 1, 1)))

    .replace(".", "")
}

const money = (amount: number) =>
  `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`

export function answerIntelligenceQuestion(
  question: string,

  metrics: IntelligenceMetrics,
) {
  const normalized = normalizeQuestion(question)

  const { ordersAnalyzed } = metrics

  if (normalized.includes("previs") || normalized.includes("proximo mes")) {
    return `Não vou estimar o próximo mês sem uma série histórica suficiente. Há ${metrics.monthlyOrders.length} meses com registros disponíveis; os volumes observados foram ${metrics.monthlyOrders.map((entry) => `${monthLabel(entry.month)}: ${entry.orders}`).join(", ") || "nenhum"}.`
  }

  if (
    metrics.scope === "operation" &&
    normalized.includes("empresa") &&
    /(mais|maior|volume|pedido|entrega)/.test(normalized)
  ) {
    const monthly = /mes|mensal/.test(normalized)
    const leader = monthly
      ? metrics.topCompanyThisMonth
      : metrics.topCompanyAllTime
    return leader
      ? `${leader.name} registrou mais pedidos ${monthly ? "neste mês" : "no histórico"}: ${leader.count}. A comparação usa somente pedidos com empresa vinculada.`
      : "Ainda não há pedidos empresariais registrados para comparar as empresas."
  }

  if (/\bkm\b|quilometr|distanci/.test(normalized)) {
    if (metrics.ordersWithDistance === 0) {
      return `A base contém ${ordersAnalyzed} pedidos, mas nenhum tem distância registrada. Não vou estimar quilômetros ausentes; o cálculo por KM está desativado por padrão e depende de uma rota registrada.`
    }

    return `${metrics.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km somados em ${metrics.ordersWithDistance} pedidos com distância registrada (média de ${metrics.averageDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km). ${metrics.ordersWithoutDistance} pedidos não têm distância registrada e não entram no cálculo.`
  }

  if (
    (normalized.includes("bairro") && /(custo|valor|preco|gasto)/.test(normalized)) ||
    /reduz.*(cust|gast)|(cust|gast).*reduz/.test(normalized)
  ) {
    const neighborhood = metrics.highestAveragePriceNeighborhood

    if (!neighborhood) {
      return `Não há valores registrados por bairro de entrega suficientes para comparar custos. A base tem ${ordersAnalyzed} pedidos, dos quais ${metrics.ordersWithRecordedPrice} têm valor informado.`
    }

    return `${neighborhood.name} tem o maior valor médio registrado entre os bairros comparáveis: ${money(neighborhood.averagePrice)} em ${neighborhood.pricedOrders} pedidos com preço informado. Isso indica maior valor médio, não prova que o custo operacional seja maior nem que reduzir preço seja seguro.`
  }

  if (
    normalized.includes("bairro") ||
    normalized.includes("regiao") ||
    normalized.includes("origem") ||
    normalized.includes("destino")
  ) {
    const pickup = metrics.topPickupNeighborhood

    const delivery = metrics.topDeliveryNeighborhood

    if (!pickup && !delivery) {
      return `Ainda não há bairros preenchidos nos ${ordersAnalyzed} pedidos analisados para comparar origens e destinos.`
    }

    const pickupText = pickup
      ? `A coleta mais frequente é em ${pickup.name} (${pickup.count} pedidos)`
      : "não há bairros de coleta preenchidos"

    const deliveryText = delivery
      ? `e a entrega mais frequente é em ${delivery.name} (${delivery.count} pedidos)`
      : "não há bairros de entrega preenchidos"

    return `${pickupText}; ${deliveryText}. A concentração mostra volume de solicitações, não comprova menor custo ou melhor rota.`
  }

  if (
    normalized.includes("solicitante") ||
    normalized.includes("quem mais") ||
    normalized.includes("quem pediu")
  ) {
    if (metrics.scope === "operation" && metrics.topCompanyThisMonth) {
      return `${metrics.topCompanyThisMonth.name} registrou mais pedidos neste mês: ${metrics.topCompanyThisMonth.count}. O painel global não expõe nomes de solicitantes individuais nesta resposta.`
    }

    const requester = metrics.topRequesterThisMonth
    return requester
      ? `${requester.name} aparece como principal solicitante entre os pedidos deste mês, com ${requester.count} registros.`
      : "Não há nomes de solicitantes informados nos pedidos deste mês para identificar uma liderança."
  }

  if (
    normalized.includes("horario") ||
    normalized.includes("hora") ||
    normalized.includes("pico")
  ) {
    const peak = metrics.peakOrderCreationHour

    return peak
      ? `O horário com mais registros de pedidos foi ${String(peak.hour).padStart(2, "0")}h, no horário de Brasília, com ${peak.count} pedidos. Isso é horário de cadastro no app, não horário de coleta ou entrega.`
      : "Ainda não há registros suficientes para identificar um horário de maior volume."
  }

  if (
    normalized.includes("mes") ||
    normalized.includes("mensal") ||
    normalized.includes("evolu")
  ) {
    return metrics.monthlyOrders.length
      ? `Pedidos por mês nos últimos meses disponíveis: ${metrics.monthlyOrders.map((entry) => `${monthLabel(entry.month)}: ${entry.orders} pedidos, ${money(entry.recordedValue)} em valores registrados`).join("; ")}. Valores sem preço informado ficam fora desses totais.`
      : "Ainda não há histórico mensal suficiente para comparar períodos."
  }

  if (
    normalized.includes("valor") ||
    normalized.includes("preco") ||
    normalized.includes("gasto") ||
    normalized.includes("financeir") ||
    normalized.includes("ticket")
  ) {
    return `${metrics.ordersAnalyzed} pedidos foram analisados. ${metrics.ordersWithRecordedPrice} têm preço registrado, somando ${money(metrics.totalRecordedValue)} e média de ${money(metrics.averageRecordedPrice)} por pedido com preço informado. ${metrics.ordersWithoutRecordedPrice} pedidos não têm preço fechado; faixas e consultas não são tratadas como valores pagos.`
  }

  if (normalized.includes("cancel") || normalized.includes("status")) {
    return `Foram analisados ${ordersAnalyzed} pedidos; ${metrics.cancelledOrders} estão marcados como cancelados. Os demais são registros de solicitação e não comprovam, por si só, que uma entrega foi concluída.`
  }

  return `Análise local de ${ordersAnalyzed} pedidos: ${metrics.cancelledOrders} estão cancelados; ${metrics.ordersWithRecordedPrice} têm valor registrado, totalizando ${money(metrics.totalRecordedValue)}; ${metrics.ordersWithDistance} têm distância registrada, somando ${metrics.totalDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km. Distâncias e valores ausentes não são estimados.`
}
