const API_URL = import.meta.env.VITE_API_URL?.trim() || "/api/v1"

export type ApiUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  role: "ADMIN" | "COMPANY" | "COURIER"
  companyId?: string
  companyPermission?: "ADMIN" | "STANDARD" | "RESTRICTED"
  isActive?: boolean
}

export type ApiOrder = {
  id: string
  publicId: string
  status: "PENDING" | "FINALIZED" | "CONFIRMED" | "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED"

  price: number | string | null
  pricingType?: ApiPricingType | null
  minimumPrice?: number | string | null
  maximumPrice?: number | string | null

  perKmRate?: number | string | null
  distance?: number | null

  priceTableName?: string | null
  recipientName: string
  recipientPhone?: string | null
  companyId?: string | null

  branchId?: string | null
  costCenterId?: string | null

  branch?: { name: string } | null
  costCenter?: { name: string } | null

  requesterName?: string | null
  requesterPhone?: string | null

  pickupStreet?: string | null
  pickupNumber?: string | null
  pickupNeighborhood?: string | null

  deliveryStreet?: string | null
  deliveryNumber?: string | null
  deliveryNeighborhood?: string | null

  createdAt: string
}

export const ORDER_STATUS_LABELS: Record<ApiOrder["status"], string> = {
  PENDING: "Pendente",
  FINALIZED: "Recebido",
  CONFIRMED: "Confirmado",
  ASSIGNED: "Aguardando coleta",
  PICKED_UP: "Coletado",
  IN_TRANSIT: "Em entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
}

export type CreateApiOrderInput = {
  pickupAddress: object
  deliveryAddress: object
  recipientName: string
  recipientPhone: string

  requesterName: string
  requesterPhone: string
  notes?: string
  branchId?: string
  costCenterId?: string
}

export type ApiWhatsAppRequest = {
  id: string
  senderPhone: string
  message: string
  status: string
  createdAt: string
}

export type ApiSettings = {
  companyName: string
  whatsappOperationsNumber: string
  supportPhone: string
  operationCity: string
  whatsappDeliveryMode?: "business_api" | "manual_fallback"
}

export type ApiCompanySettings = {
  name: string
  document: string
  phone: string
  email: string
  address: string
}

export type ApiPeriodSummary = { orders: number; total: number; average: number }

export type ApiDashboardSummary = {
  today: ApiPeriodSummary
  week: ApiPeriodSummary
  month: ApiPeriodSummary
  allTime: ApiPeriodSummary
  timezone: string
}

export type ApiDashboardCharts = {
  recentDays: Array<{ name: string; orders: number }>

  months: Array<{ name: string; orders: number; total: number }>

  hours: Array<{ hour: number; label: string; orders: number }>

  neighborhoods: Array<{ name: string; value: number }>

  companyVolume: Array<{ name: string; orders: number }>

  peakNeighborhood: string

  peakHour: { hour: number; label: string; orders: number }

  previousMonthOrders: number

  currentMonthOrders: number
}

export type ApiIntelligenceNamedCount = { name: string; count: number }

export type ApiIntelligenceMetrics = {
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

  topPickupNeighborhood: ApiIntelligenceNamedCount | null

  topDeliveryNeighborhood: ApiIntelligenceNamedCount | null

  highestAveragePriceNeighborhood: {
    name: string
    pricedOrders: number
    averagePrice: number
  } | null

  topRequesterThisMonth: ApiIntelligenceNamedCount | null

  topCompanyThisMonth: ApiIntelligenceNamedCount | null

  topCompanyAllTime: ApiIntelligenceNamedCount | null

  peakOrderCreationHour: { hour: number; count: number } | null

  monthlyOrders: Array<{ month: string; orders: number; recordedValue: number }>
}

export type ApiPricingRoute = {
  id: string
  city: string
  pickupNeighborhood: string
  deliveryNeighborhood: string
  price: number | string
  active: boolean
}

export type ApiPricingType = "FIXED" | "RANGE" | "PER_KM" | "QUOTE"

export type ApiDeliveryPrice = {
  success: true
  pricingType: "FIXED"
  origin: string
  destination: string
  priceTable?: string
  priceTableId?: string
  price: number
} | {
  success: true
  pricingType: "RANGE"
  origin: string
  destination: string
  priceTable?: string
  priceTableId?: string
  minimumPrice: number
  maximumPrice: number
} | {
  success: true
  pricingType: "PER_KM"
  origin: string
  destination: string
  priceTable?: string
  priceTableId?: string
  perKmRate?: number
  distanceKm?: number
  price?: number
} | {
  success: true
  pricingType: "QUOTE"
  origin: string
  destination: string
  priceTable?: string
  priceTableId?: string
}

export type ApiPriceTableDestination = {
  id: string
  priceTableId: string
  destinationName: string
  normalizedDestinationName: string
  pricingType: ApiPricingType

  fixedPrice: number | string | null
  minimumPrice: number | string | null
  maximumPrice: number | string | null

  perKmRate?: number | string | null
  active: boolean
}

export type ApiPriceTableOrigin = {
  id: string
  priceTableId: string
  originName: string
  normalizedOriginName: string
  active: boolean
}

export type ApiPriceTable = {
  id: string
  name: string
  description?: string | null
  active: boolean

  origins: ApiPriceTableOrigin[]
  destinations: ApiPriceTableDestination[]
}

export type ApiCompany = {
  id: string
  name: string
  document?: string | null
  _count: { orders: number; users: number }

  monthlyOrders?: number
  subscription?: ApiSubscription | null
}

export type PublicSettings = {
  whatsappOperationsNumber: string
  supportPhone: string
  operationCity: string
}

export type ApiCompanyMember = Pick<ApiUser, "id" | "name" | "email" | "phone" | "role" | "companyPermission" | "isActive">

export type ApiBranch = {
  id: string
  name: string
  phone?: string | null
  address?: { text?: string } | null
  isActive: boolean
}

export type ApiCostCenter = {
  id: string
  name: string
  code?: string | null
  isActive: boolean
}

export type ApiOrganization = {
  company: ApiCompanySettings & { id: string }

  members: ApiCompanyMember[]

  branches: ApiBranch[]

  costCenters: ApiCostCenter[]

  subscription: ApiSubscription | null
}

export type ApiLead = {
  id: string
  companyName: string
  contactName: string
  email?: string | null
  phone?: string | null

  city?: string | null
  source?: string | null
  stage: "LEAD" | "QUALIFIED" | "PROPOSAL" | "CLOSED_WON" | "CLOSED_LOST"

  estimatedMonthlyRevenue?: number | string | null
  notes?: string | null
  followUpAt?: string | null

  createdAt: string
  updatedAt: string
}

export type ApiPlan = {
  id: string
  name: string
  description?: string | null
  monthlyPrice: number | string
  annualPrice: number | string

  monthlyOrderLimit?: number | null
  isActive: boolean
  _count?: { subscriptions: number }
}

export type ApiSubscription = {
  id: string
  companyId: string
  planId: string
  status: "ACTIVE" | "OVERDUE" | "INACTIVE"

  monthlyPrice: number | string
  startedAt: string
  renewalAt?: string | null
  endedAt?: string | null

  company?: { id: string; name: string }
  plan: { id: string; name: string }
}

export type ApiFinancialEntry = {
  id: string
  type: "INCOME" | "EXPENSE"
  description: string
  category: string
  amount: number | string

  occurredAt: string
  company?: { id: string; name: string } | null
}

export type ApiFinancialMonth = {
  month: string
  income: number
  expenses: number
}

export type ApiAuditLog = {
  id: string
  actorId?: string | null
  actorName: string
  action: string
  entity: string

  entityId?: string | null
  details?: unknown
  createdAt: string
}

export type ApiIntegration = {
  id: string
  name: string
  description: string
  status: "ACTIVE" | "SETUP_REQUIRED" | "NOT_AVAILABLE"
  note: string
}

export type ApiSystemUser = {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
}

export async function loginRequest(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ email, password }),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) throw new Error(body.error || "Não foi possível entrar.")

  return body as { token: string; user: ApiUser }
}

export async function currentUserRequest(token: string) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) throw new Error("Sessão expirada.")

  return (await response.json()) as { user: ApiUser }
}

export async function changePasswordRequest(
  token: string,
  currentPassword: string,
  newPassword: string,
) {
  return authorizedRequest<{ ok: boolean }>("/auth/change-password", token, {
    method: "POST",

    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

async function authorizedRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok)
    throw new Error(body.error || "Não foi possível carregar os dados.")

  return body as T
}

export type ApiOrderListQuery = {
  page?: number

  pageSize?: number

  search?: string

  status?: ApiOrder["status"] | "COMPLETED"

  companyId?: string

  from?: string

  to?: string
}

export type ApiOrderListResult = {
  orders: ApiOrder[]

  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export async function getPanelOrders(
  token: string,

  role: "admin" | "company" | "courier",

  query: ApiOrderListQuery = {},
) {
  const path =
    role === "company"
      ? "/company/orders"
      : role === "courier"
        ? "/courier/orders"
        : "/admin/orders"

  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value))
  })

  const queryString = params.size ? `?${params.toString()}` : ""

  return authorizedRequest<ApiOrderListResult>(`${path}${queryString}`, token)
}

export async function getDashboardSummary(token: string) {
  return authorizedRequest<{ summary: ApiDashboardSummary }>(
    "/dashboard/summary",
    token,
  )
}

export async function getDashboardCharts(token: string) {
  return authorizedRequest<{ charts: ApiDashboardCharts }>(
    "/dashboard/charts",
    token,
  )
}

export async function askIntelligence(token: string, question: string) {
  return authorizedRequest<{ answer: string; metrics: ApiIntelligenceMetrics }>(
    "/intelligence/ask",
    token,
    {
      method: "POST",

      body: JSON.stringify({ question }),
    },
  )
}

export async function getAdminCompanies(token: string) {
  return authorizedRequest<{ companies: ApiCompany[] }>(
    "/admin/companies",
    token,
  )
}

export async function getPricingRoutes(token: string) {
  return authorizedRequest<{ routes: ApiPricingRoute[] }>(
    "/admin/pricing-routes",
    token,
  )
}

export async function savePricingRoute(
  token: string,
  route: Omit<ApiPricingRoute, "id">,
  id?: string,
) {
  return authorizedRequest<{ route: ApiPricingRoute }>(
    id
      ? `/admin/pricing-routes/${encodeURIComponent(id)}`
      : "/admin/pricing-routes",
    token,
    {
      method: id ? "PUT" : "POST",

      body: JSON.stringify(route),
    },
  )
}

export async function deactivatePricingRoute(token: string, id: string) {
  return authorizedRequest<{ route: ApiPricingRoute }>(
    `/admin/pricing-routes/${encodeURIComponent(id)}`,
    token,
    { method: "DELETE" },
  )
}

export async function getPublicSettings() {
  const response = await fetch(`${API_URL}/public/settings`)

  const body = await response.json().catch(() => ({}))

  if (!response.ok)
    throw new Error(
      body.error || "Não foi possível carregar as configurações públicas.",
    )

  return body as PublicSettings
}

export async function getRoutePrice(
  pickupNeighborhood: string,

  deliveryNeighborhood: string,

  city = "Juiz de Fora",

  coordinates?: {
    pickup?: { latitude: number; longitude: number }
    delivery?: { latitude: number; longitude: number }
  },
): Promise<ApiDeliveryPrice> {
  const params = new URLSearchParams({
    city,
    pickupNeighborhood,
    deliveryNeighborhood,
  })

  if (coordinates?.pickup && coordinates.delivery) {
    params.set("pickupLatitude", String(coordinates.pickup.latitude))

    params.set("pickupLongitude", String(coordinates.pickup.longitude))

    params.set("deliveryLatitude", String(coordinates.delivery.latitude))

    params.set("deliveryLongitude", String(coordinates.delivery.longitude))
  }

  const response = await fetch(`${API_URL}/pricing/route?${params}`)

  const body = await response.json().catch(() => ({}))

  if (!response.ok)
    throw new Error(body.error || "Não foi possível consultar o preço da rota.")

  const rawRoute: unknown = body.route

  if (
    typeof rawRoute !== "object" ||
    rawRoute === null ||
    Array.isArray(rawRoute)
  ) {
    throw new Error(
      "A API retornou uma resposta inválida para o preço da rota.",
    )
  }

  const route = rawRoute as Record<string, unknown>

  if ("success" in route && route.success === false && "reason" in route) {
    if (
      route.reason === "ORIGIN_NOT_FOUND" ||
      route.reason === "DESTINATION_NOT_FOUND"
    ) {
      return {
        success: true,
        pricingType: "QUOTE",
        origin: pickupNeighborhood,
        destination: deliveryNeighborhood,
      }
    }

    throw new Error("A API retornou um motivo inválido para a rota.")
  }

  if ("success" in route && route.success === true && "pricingType" in route) {
    const pricingType = route.pricingType

    const origin =
      "origin" in route && typeof route.origin === "string"
        ? route.origin
        : pickupNeighborhood

    const destination =
      "destination" in route && typeof route.destination === "string"
        ? route.destination
        : deliveryNeighborhood

    const priceTable =
      "priceTable" in route && typeof route.priceTable === "string"
        ? route.priceTable
        : undefined

    const priceTableId =
      "priceTableId" in route && typeof route.priceTableId === "string"
        ? route.priceTableId
        : undefined

    if (pricingType === "FIXED") {
      const price = Number(route.price)

      if (!Number.isFinite(price) || price <= 0)
        throw new Error("A API retornou um preço inválido para a rota.")

      return {
        success: true,
        pricingType,
        origin,
        destination,
        priceTable,
        priceTableId,
        price,
      }
    }

    if (pricingType === "RANGE") {
      const minimumPrice = Number(route.minimumPrice)

      const maximumPrice = Number(route.maximumPrice)

      if (
        !Number.isFinite(minimumPrice) ||
        !Number.isFinite(maximumPrice) ||
        minimumPrice <= 0 ||
        maximumPrice < minimumPrice
      ) {
        throw new Error(
          "A API retornou uma faixa de preço inválida para a rota.",
        )
      }

      return {
        success: true,
        pricingType,
        origin,
        destination,
        priceTable,
        priceTableId,
        minimumPrice,
        maximumPrice,
      }
    }

    if (pricingType === "PER_KM") {
      const perKmRate =
        route.perKmRate === undefined ? undefined : Number(route.perKmRate)

      const distanceKm =
        route.distanceKm === undefined ? undefined : Number(route.distanceKm)

      const price = route.price === undefined ? undefined : Number(route.price)

      if (
        perKmRate !== undefined &&
        (!Number.isFinite(perKmRate) || perKmRate <= 0)
      ) {
        throw new Error("A API retornou uma tarifa por KM inválida.")
      }

      if (
        distanceKm !== undefined &&
        (!Number.isFinite(distanceKm) || distanceKm <= 0)
      ) {
        throw new Error("A API retornou uma distância inválida para a rota.")
      }

      if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
        throw new Error("A API retornou um preço inválido para a rota.")
      }

      return {
        success: true,
        pricingType,
        origin,
        destination,
        priceTable,
        priceTableId,
        perKmRate,
        distanceKm,
        price,
      }
    }

    if (pricingType === "QUOTE")
      return {
        success: true,
        pricingType,
        origin,
        destination,
        priceTable,
        priceTableId,
      }

    throw new Error("A API retornou um tipo de tarifa inválido para a rota.")
  }

  if ("price" in route) {
    const price = Number(route.price)

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("A API retornou um preço inválido para a rota.")
    }

    return {
      success: true as const,

      pricingType: "FIXED" as const,

      origin: pickupNeighborhood,

      destination: deliveryNeighborhood,

      price,
    }
  }

  throw new Error("A API retornou uma resposta inválida para o preço da rota.")
}

export async function getAdminPriceTables(token: string) {
  return authorizedRequest<{ tables: ApiPriceTable[] }>(
    "/admin/price-tables",
    token,
  )
}

export async function createAdminPriceTable(
  token: string,
  table: { name: string; description?: string },
) {
  return authorizedRequest<{ table: ApiPriceTable }>(
    "/admin/price-tables",
    token,
    {
      method: "POST",

      body: JSON.stringify(table),
    },
  )
}

export async function updateAdminPriceTable(
  token: string,
  id: string,
  updates: Partial<Pick<ApiPriceTable, "name" | "description" | "active">>,
) {
  return authorizedRequest<{ table: ApiPriceTable }>(
    `/admin/price-tables/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function createPriceTableOrigin(
  token: string,
  tableId: string,
  originName: string,
) {
  return authorizedRequest<{ origin: ApiPriceTableOrigin }>(
    `/admin/price-tables/${encodeURIComponent(tableId)}/origins`,
    token,
    {
      method: "POST",

      body: JSON.stringify({ originName }),
    },
  )
}

export async function updatePriceTableOrigin(
  token: string,
  tableId: string,
  originId: string,
  updates: Partial<Pick<ApiPriceTableOrigin, "originName" | "active">>,
) {
  return authorizedRequest<{ origin: ApiPriceTableOrigin }>(
    `/admin/price-tables/${encodeURIComponent(tableId)}/origins/${encodeURIComponent(originId)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function deactivatePriceTableOrigin(
  token: string,
  tableId: string,
  originId: string,
) {
  return authorizedRequest<{ origin: ApiPriceTableOrigin }>(
    `/admin/price-tables/${encodeURIComponent(tableId)}/origins/${encodeURIComponent(originId)}`,
    token,
    {
      method: "DELETE",
    },
  )
}

export type PriceTableDestinationInput = {
  destinationName: string
  pricingType: ApiPricingType

  fixedPrice?: number
  minimumPrice?: number
  maximumPrice?: number
  perKmRate?: number
}

export async function savePriceTableDestination(
  token: string,
  tableId: string,
  destination: PriceTableDestinationInput,
  id?: string,
) {
  return authorizedRequest<{ destination: ApiPriceTableDestination }>(
    id
      ? `/admin/price-tables/${encodeURIComponent(tableId)}/destinations/${encodeURIComponent(id)}`
      : `/admin/price-tables/${encodeURIComponent(tableId)}/destinations`,

    token,

    { method: id ? "PUT" : "POST", body: JSON.stringify(destination) },
  )
}

export async function setPriceTableDestinationActive(
  token: string,
  tableId: string,
  id: string,
  active: boolean,
) {
  return authorizedRequest<{ destination: ApiPriceTableDestination }>(
    `/admin/price-tables/${encodeURIComponent(tableId)}/destinations/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({ active }),
    },
  )
}

export async function importPriceTableDestinations(
  token: string,
  tableId: string,
  destinations: PriceTableDestinationInput[],
) {
  return authorizedRequest<{ imported: number }>(
    `/admin/price-tables/${encodeURIComponent(tableId)}/import`,
    token,
    {
      method: "POST",

      body: JSON.stringify({ destinations }),
    },
  )
}

export function formatOrderPrice(
  order: Pick<ApiOrder, "price" | "pricingType" | "minimumPrice" | "maximumPrice">,
) {
  if (
    order.pricingType === "RANGE" &&
    order.minimumPrice !== null &&
    order.minimumPrice !== undefined &&
    order.maximumPrice !== null &&
    order.maximumPrice !== undefined
  ) {
    return `R$ ${Number(order.minimumPrice).toFixed(2).replace(".", ",")} a R$ ${Number(order.maximumPrice).toFixed(2).replace(".", ",")}`
  }

  if (order.pricingType === "PER_KM" && order.price !== null)
    return `R$ ${Number(order.price).toFixed(2).replace(".", ",")}`

  if (
    order.pricingType === "PER_KM" ||
    order.pricingType === "QUOTE" ||
    order.price === null
  )
    return "Consultar valor"

  return `R$ ${Number(order.price).toFixed(2).replace(".", ",")}`
}

export async function updateOrderStatus(
  token: string,
  id: string,
  status: ApiOrder["status"],
) {
  return authorizedRequest<{ order: ApiOrder }>(
    `/admin/orders/${encodeURIComponent(id)}/status`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({ status }),
    },
  )
}

export async function getCourierOrders(token: string) {
  return authorizedRequest<{ orders: ApiOrder[] }>("/courier/orders", token)
}

export async function updateCourierOrderStatus(
  token: string,
  id: string,
  status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED",
) {
  return authorizedRequest<{ order: ApiOrder }>(
    `/courier/orders/${encodeURIComponent(id)}/status`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  )
}

export async function getWhatsAppRequests(token: string) {
  return authorizedRequest<{ requests: ApiWhatsAppRequest[] }>(
    "/admin/whatsapp-requests",
    token,
  )
}

export async function updateWhatsAppRequestStatus(
  token: string,
  id: string,
  status: "DRAFT" | "IN_ATTENDANCE" | "COMPLETED" | "CANCELLED",
) {
  return authorizedRequest<{ request: ApiWhatsAppRequest }>(
    `/admin/whatsapp-requests/${encodeURIComponent(id)}/status`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({ status }),
    },
  )
}

export async function getSettings(token: string) {
  return authorizedRequest<{ settings: ApiSettings }>("/admin/settings", token)
}

export async function saveSettings(token: string, settings: ApiSettings) {
  return authorizedRequest<{ settings: ApiSettings }>(
    "/admin/settings",
    token,
    {
      method: "PUT",

      body: JSON.stringify(settings),
    },
  )
}

export async function getCompanySettings(token: string) {
  return authorizedRequest<{ settings: ApiCompanySettings }>(
    "/company/settings",
    token,
  )
}

export async function saveCompanySettings(
  token: string,
  settings: ApiCompanySettings,
) {
  return authorizedRequest<{ settings: ApiCompanySettings }>(
    "/company/settings",
    token,
    {
      method: "PUT",

      body: JSON.stringify(settings),
    },
  )
}

export async function getAdminLeads(token: string) {
  return authorizedRequest<{ leads: ApiLead[] }>("/admin/leads", token)
}

export async function saveAdminLead(
  token: string,
  lead: Partial<ApiLead> & Pick<ApiLead, "companyName" | "contactName">,
  id?: string,
) {
  return authorizedRequest<{ lead: ApiLead }>(
    id ? `/admin/leads/${encodeURIComponent(id)}` : "/admin/leads",
    token,
    {
      method: id ? "PATCH" : "POST",

      body: JSON.stringify(lead),
    },
  )
}

export async function getAdminPlans(token: string) {
  return authorizedRequest<{ plans: ApiPlan[] }>("/admin/plans", token)
}

export async function saveAdminPlan(
  token: string,
  plan: Pick<ApiPlan, "name" | "monthlyPrice" | "annualPrice"> & Partial<ApiPlan>,
) {
  return authorizedRequest<{ plan: ApiPlan }>("/admin/plans", token, {
    method: "POST",

    body: JSON.stringify(plan),
  })
}

export async function updateAdminPlan(
  token: string,
  id: string,
  updates: Partial<ApiPlan>,
) {
  return authorizedRequest<{ plan: ApiPlan }>(
    `/admin/plans/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function getAdminSubscriptions(token: string) {
  return authorizedRequest<{ subscriptions: ApiSubscription[] }>(
    "/admin/subscriptions",
    token,
  )
}

export async function createAdminSubscription(
  token: string,
  subscription: {
    companyId: string
    planId: string
    status: ApiSubscription["status"]
    monthlyPrice?: number
    startedAt?: string
    renewalAt?: string | null
  },
) {
  return authorizedRequest<{ subscription: ApiSubscription }>(
    "/admin/subscriptions",
    token,
    {
      method: "POST",

      body: JSON.stringify(subscription),
    },
  )
}

export async function updateAdminSubscription(
  token: string,
  id: string,
  updates: Partial<Pick<ApiSubscription, "status" | "renewalAt" | "monthlyPrice">>,
) {
  return authorizedRequest<{ subscription: ApiSubscription }>(
    `/admin/subscriptions/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function getAdminFinancialEntries(
  token: string,
  query: {
    offset?: number
    limit?: number
    search?: string
    type?: ApiFinancialEntry["type"]
    from?: string
    to?: string
  } = {},
) {
  const params = new URLSearchParams()
  if (query.offset != null) params.set("offset", String(query.offset))
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.search) params.set("search", query.search)
  if (query.type) params.set("type", query.type)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  const queryString = params.size > 0 ? `?${params.toString()}` : ""

  return authorizedRequest<{ entries: ApiFinancialEntry[]; total: number }>(
    `/admin/financial-entries${queryString}`,
    token,
  )
}

export async function getAdminFinancialSummary(token: string) {
  return authorizedRequest<{ months: ApiFinancialMonth[] }>(
    "/admin/financial-summary",
    token,
  )
}

export async function createAdminFinancialEntry(
  token: string,
  entry: Omit<ApiFinancialEntry, "id" | "company"> & {
    companyId?: string | null
  },
) {
  return authorizedRequest<{ entry: ApiFinancialEntry }>(
    "/admin/financial-entries",
    token,
    {
      method: "POST",

      body: JSON.stringify(entry),
    },
  )
}

export async function getAdminAuditLogs(token: string) {
  return authorizedRequest<{ logs: ApiAuditLog[] }>("/admin/audit-logs", token)
}

export async function getAdminSystemUsers(token: string) {
  return authorizedRequest<{ users: ApiSystemUser[] }>(
    "/admin/system-users",
    token,
  )
}

export async function createAdminSystemUser(
  token: string,
  user: { name: string; email: string; phone?: string; password: string },
) {
  return authorizedRequest<{ user: ApiSystemUser }>(
    "/admin/system-users",
    token,
    {
      method: "POST",

      body: JSON.stringify(user),
    },
  )
}

export async function updateAdminSystemUser(
  token: string,
  id: string,
  isActive: boolean,
) {
  return authorizedRequest<{ user: ApiSystemUser }>(
    `/admin/system-users/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify({ isActive }),
    },
  )
}

export async function getAdminIntegrations(token: string) {
  return authorizedRequest<{ integrations: ApiIntegration[] }>(
    "/admin/integrations",
    token,
  )
}

export async function getCompanyOrganization(token: string) {
  return authorizedRequest<{ organization: ApiOrganization }>(
    "/company/organization",
    token,
  )
}

export async function createCompanyMember(
  token: string,
  member: {
    name: string
    email: string
    phone?: string
    password: string
    companyPermission?: NonNullable<ApiUser["companyPermission"]>
  },
) {
  return authorizedRequest<{ member: ApiCompanyMember }>(
    "/company/members",
    token,
    {
      method: "POST",

      body: JSON.stringify(member),
    },
  )
}

export async function updateCompanyMember(
  token: string,
  id: string,
  updates: {
    isActive?: boolean
    companyPermission?: NonNullable<ApiUser["companyPermission"]>
  },
) {
  return authorizedRequest<{ member: ApiCompanyMember }>(
    `/company/members/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function createCompanyBranch(
  token: string,
  branch: { name: string; phone?: string; address?: string },
) {
  return authorizedRequest<{ branch: ApiBranch }>("/company/branches", token, {
    method: "POST",

    body: JSON.stringify(branch),
  })
}

export async function updateCompanyBranch(
  token: string,
  id: string,
  updates: Partial<{
    name: string
    phone: string
    address: string
    isActive: boolean
  }>,
) {
  return authorizedRequest<{ branch: ApiBranch }>(
    `/company/branches/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function createCompanyCostCenter(
  token: string,
  costCenter: { name: string; code?: string },
) {
  return authorizedRequest<{ costCenter: ApiCostCenter }>(
    "/company/cost-centers",
    token,
    {
      method: "POST",

      body: JSON.stringify(costCenter),
    },
  )
}

export async function updateCompanyCostCenter(
  token: string,
  id: string,
  updates: Partial<{ name: string; code: string; isActive: boolean }>,
) {
  return authorizedRequest<{ costCenter: ApiCostCenter }>(
    `/company/cost-centers/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",

      body: JSON.stringify(updates),
    },
  )
}

export async function createPublicOrder(
  input: CreateApiOrderInput,
  token?: string,
) {
  const response = await fetch(`${API_URL}/orders`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },

    body: JSON.stringify(input),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok)
    throw new Error(body.error || "Não foi possível salvar o pedido.")

  return { ...body.order, whatsapp: body.whatsapp } as {
    publicId: string
    trackingToken: string
    status: ApiOrder["status"]
    price: number | string | null

    pricingType: ApiPricingType
    minimumPrice: number | string | null
    maximumPrice: number | string | null

    perKmRate?: number | string | null
    distance?: number | null

    whatsapp?: {
      status: "sent" | "pending" | "failed" | "not_configured" | "unknown"
      fallbackUrl?: string
    }
  }
}
