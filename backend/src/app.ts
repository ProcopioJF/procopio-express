import express, { type RequestHandler } from "express";
import cors from "cors";
import { OrderStatus, Prisma, RoleName } from "@prisma/client";
import { prisma } from "./db.js";
import { config, databaseConfigured } from "./config.js";
import { createAccessToken, hashPassword, publicUser, verifyPassword } from "./auth.js";
import { bearerAuth, requireAuth } from "./middleware/auth.js";
import { developmentActor } from "./middleware/placeholderAuth.js";
import { errorHandler, HttpError, notFound } from "./middleware/errors.js";
import { createOrder, getPublicOrder } from "./services/orders.js";
import { notifyNewOrder } from "./services/whatsapp.js";
import { processIncomingWebhook, verifyWebhookSignature } from "./services/whatsappWebhook.js";
import { getRoutePrice } from "./services/pricing.js";
import {
  answerIntelligenceQuestion,
  getIntelligenceMetrics,
  resolveIntelligenceScope,
} from "./services/intelligence.js";
import { getDashboardCharts } from "./services/dashboard-charts.js";
import { adminRouter, companyRouter } from "./routes/management.js";
import { adminOrderStatusSchema, changePasswordSchema, courierOrderStatusSchema, createCompanySchema, intelligenceQuestionSchema, loginSchema, orderListQuerySchema, pricingRouteQuerySchema, pricingRouteSchema, pricingSchema, settingsSchema, whatsappRequestStatusSchema } from "./validation.js";

export const app = express();
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);
const allowedOrigins = config.nodeEnv === "production"
  ? [...new Set([...config.corsOrigins, ...vercelOrigins])]
  : [...new Set(["http://localhost:8443", "http://127.0.0.1:8443", ...config.corsOrigins, ...vercelOrigins])];
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ verify: (req, _res, buffer) => { (req as express.Request).rawBody = buffer.toString("utf8"); } }));
app.use(bearerAuth);
app.use(developmentActor);
app.get(["/health", "/api/health"], async (_req, res) => {
  if (!databaseConfigured) return res.status(503).json({ status: "degraded", database: "not_configured", message: "Configure DATABASE_URL com uma conexão PostgreSQL válida." });
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: "ok", database: "ok" }); }
  catch (error) {
    console.error("O health check não conseguiu conectar ao banco de dados.", error);
    res.status(503).json({ status: "degraded", database: "unavailable", message: "Não foi possível conectar ao banco configurado." });
  }
});
app.get(["/webhooks/whatsapp", "/api/webhooks/whatsapp"], (req, res) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  if (mode === "subscribe" && token === config.whatsappVerifyToken && config.whatsappVerifyToken) return res.status(200).send(challenge);
  return res.sendStatus(403);
});
app.post(["/webhooks/whatsapp", "/api/webhooks/whatsapp"], async (req, res, next) => {
  try {
    const rawBody = req.rawBody ?? JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, req.header("x-hub-signature-256"))) return res.sendStatus(401);
    const result = await processIncomingWebhook(JSON.parse(rawBody));
    res.status(200).json({ received: true, result });
  } catch (error) { next(error); }
});
const api = express.Router();
api.use("/admin", adminRouter);
api.use("/company", companyRouter);
async function listOrders(
  rawQuery: unknown,
  options: { companyId?: string; allowCompanyFilter: boolean },
) {
  const query = orderListQuerySchema.parse(rawQuery)
  const where: Prisma.OrderWhereInput = {}
  if (options.companyId) where.companyId = options.companyId
  else if (options.allowCompanyFilter && query.companyId) where.companyId = query.companyId
  if (query.status === "COMPLETED") where.status = { in: ["FINALIZED", "DELIVERED"] }
  else if (query.status) where.status = query.status
  if (query.from || query.to) {
    const dateFilter: Prisma.DateTimeFilter = {}
    if (query.from) {
      const start = new Date(`${query.from}T03:00:00.000Z`)
      if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== query.from) {
        throw new HttpError(400, "Data inicial inválida.")
      }
      dateFilter.gte = start
    }
    if (query.to) {
      const end = new Date(`${query.to}T03:00:00.000Z`)
      if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== query.to) {
        throw new HttpError(400, "Data final inválida.")
      }
      end.setUTCDate(end.getUTCDate() + 1)
      dateFilter.lt = end
    }
    where.createdAt = dateFilter
  }
  if (query.search) {
    where.OR = [
      { publicId: { contains: query.search, mode: "insensitive" } },
      { requesterName: { contains: query.search, mode: "insensitive" } },
      { recipientName: { contains: query.search, mode: "insensitive" } },
      { pickupNeighborhood: { contains: query.search, mode: "insensitive" } },
      { deliveryNeighborhood: { contains: query.search, mode: "insensitive" } },
    ]
  }
  const skip = (query.page - 1) * query.pageSize
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
      include: { branch: { select: { name: true } }, costCenter: { select: { name: true } } },
    }),
    prisma.order.count({ where }),
  ])
  return {
    orders,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  }
}
const requireCurrentUserIfAuthenticated: RequestHandler = (req, res, next) => {
  if (config.nodeEnv !== "production" && req.header("x-dev-role")) return next();
  if (!req.actor) return next();
  return requireAuth(req, res, next);
};
api.post("/auth/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() }, include: { role: true } });
    if (!user?.isActive || !user.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new HttpError(401, "E-mail ou senha inválidos");
    }
    const actor = { id: user.id, role: user.role.name, companyId: user.companyId ?? undefined };
    res.json({ token: createAccessToken(actor), user: publicUser(user) });
  } catch (e) { next(e); }
});
api.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.actor!.id }, include: { role: true } });
    if (!user) throw new HttpError(401, "Usuário não encontrado");
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});
api.post("/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.actor!.id } });
    if (!user?.passwordHash || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new HttpError(401, "Senha atual inválida");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
api.post("/orders", requireCurrentUserIfAuthenticated, async (req, res, next) => {
  try {
    const companyId = req.actor?.role === "COMPANY" ? req.actor.companyId : undefined;
    const order = await createOrder(req.body, req.actor?.id, companyId);
    let whatsapp: { status: "sent" | "pending" | "failed" | "not_configured" | "unknown"; fallbackUrl?: string };
    try {
      whatsapp = await notifyNewOrder(order);
    } catch (error) {
      console.error(`Pedido ${order.publicId} salvo, mas o resultado do WhatsApp não pôde ser confirmado`, error);
      whatsapp = { status: "failed", fallbackUrl: undefined };
    }
    res.status(201).json({
      order: {
        publicId: order.publicId,
        trackingToken: order.trackingToken,
        status: order.status,
        price: order.price,
        pricingType: order.pricingType,
        perKmRate: order.perKmRate,
        distance: order.distance,
        minimumPrice: order.minimumPrice,
        maximumPrice: order.maximumPrice,
      },
      whatsapp: { status: whatsapp.status, fallbackUrl: whatsapp.fallbackUrl },
    });
  } catch (e) { next(e); }
});
api.get("/orders/:publicId", async (req, res, next) => { try { res.json({ order: await getPublicOrder(req.params.publicId, req.query.token as string | undefined) }); } catch (e) { next(e); } });
api.get("/public/settings", async (_req, res, next) => {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ["companyName", "whatsappOperationsNumber", "supportPhone", "operationCity"] } } });
    const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
    res.json({
      companyName: typeof values.companyName === "string" && values.companyName.trim() ? values.companyName : "Procópio Express",
      whatsappOperationsNumber: typeof values.whatsappOperationsNumber === "string" ? values.whatsappOperationsNumber : config.whatsappOperationsNumber,
      supportPhone: typeof values.supportPhone === "string" ? values.supportPhone : "",
      operationCity: typeof values.operationCity === "string" && values.operationCity.trim() ? values.operationCity : "Juiz de Fora",
    });
  } catch (e) { next(e); }
});
api.get("/pricing/route", async (req, res, next) => {
  try {
    const query = pricingRouteQuerySchema.parse(req.query);
    const pickupCoordinates = query.pickupLatitude !== undefined && query.pickupLongitude !== undefined
      ? { latitude: query.pickupLatitude, longitude: query.pickupLongitude }
      : undefined;
    const deliveryCoordinates = query.deliveryLatitude !== undefined && query.deliveryLongitude !== undefined
      ? { latitude: query.deliveryLatitude, longitude: query.deliveryLongitude }
      : undefined;
    const route = await getRoutePrice(
      query.city,
      query.pickupNeighborhood,
      query.deliveryNeighborhood,
      pickupCoordinates,
      deliveryCoordinates,
    );
    res.json({ route });
  } catch (e) { next(e); }
});
api.get("/pricing", async (req, res, next) => { try { const query = pricingSchema.parse(req.query); const zone = query.pricingZoneId ? await prisma.pricingZone.findUnique({ where: { id: query.pricingZoneId } }) : await prisma.pricingZone.findFirst({ where: { active: true } }); if (!zone) throw new HttpError(404, "Zona de preço não encontrada"); res.json({ zone: { id: zone.id, nome: zone.name }, price: zone.basePrice }); } catch (e) { next(e); } });
api.get("/admin/orders", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); res.json(await listOrders(req.query, { allowCompanyFilter: true })); } catch (e) { next(e); } });
api.get("/admin/companies", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { orders: true, users: true } } } }); res.json({ companies }); } catch (e) { next(e); } });
api.post("/admin/companies", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito");
    const data = createCompanySchema.parse(req.body);
    const role = await prisma.role.findUnique({ where: { name: RoleName.COMPANY } });
    if (!role) throw new HttpError(500, "Perfil de empresa não está configurado no sistema.");
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "Já existe uma conta com este e-mail.");
    if (data.document && await prisma.company.findUnique({ where: { document: data.document } })) {
      throw new HttpError(409, "Já existe uma empresa cadastrada com este documento.");
    }
    const companyAddress = data.pickupAddress;
    const addressText = [
      `${companyAddress.rua}, ${companyAddress.numero}`,
      companyAddress.complemento,
      companyAddress.bairro,
      `${companyAddress.cidade}, ${companyAddress.estado}`,
    ].filter(Boolean).join(", ");
    const passwordHash = await hashPassword(data.password);
    const company = await prisma.$transaction(async tx => {
      const createdCompany = await tx.company.create({
        data: {
          name: data.name,
          document: data.document || null,
          phone: data.phone || null,
          email,
          address: { text: addressText, pickupAddress: companyAddress },
        },
      });
      await tx.user.create({
        data: { name: data.name, email, passwordHash, roleId: role.id, companyId: createdCompany.id, companyPermission: "ADMIN", isActive: true },
      });
      return createdCompany;
    });
    res.status(201).json({ company: { ...company, _count: { orders: 0, users: 1 } } });
  } catch (e) { next(e); }
});
api.get("/admin/pricing-routes", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); res.json({ routes: await prisma.pricingRoute.findMany({ orderBy: [{ city: "asc" }, { pickupNeighborhood: "asc" }, { deliveryNeighborhood: "asc" }] }) }); } catch (e) { next(e); } });
api.post("/admin/pricing-routes", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const data = pricingRouteSchema.parse(req.body); const where = { city_pickupNeighborhood_deliveryNeighborhood: { city: data.city, pickupNeighborhood: data.pickupNeighborhood, deliveryNeighborhood: data.deliveryNeighborhood } }; const existing = await prisma.pricingRoute.findUnique({ where }); const route = existing ? await prisma.pricingRoute.update({ where: { id: existing.id }, data }) : await prisma.pricingRoute.create({ data }); res.status(existing ? 200 : 201).json({ route }); } catch (e) { next(e); } });
api.put("/admin/pricing-routes/:id", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const data = pricingRouteSchema.parse(req.body); res.json({ route: await prisma.pricingRoute.update({ where: { id: String(req.params.id) }, data }) }); } catch (e) { next(e); } });
api.delete("/admin/pricing-routes/:id", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); res.json({ route: await prisma.pricingRoute.update({ where: { id: String(req.params.id) }, data: { active: false } }) }); } catch (e) { next(e); } });
api.get("/dashboard/summary", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || !["ADMIN", "COMPANY"].includes(req.actor.role)) throw new HttpError(403, "Acesso restrito");
    if (req.actor.role === "COMPANY" && !req.actor.companyId) throw new HttpError(403, "Empresa não identificada");
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const datePart = (type: string) => Number(parts.find(part => part.type === type)?.value);
    const localMidnightUtc = Date.UTC(datePart("year"), datePart("month") - 1, datePart("day"), 3);
    const dayStart = new Date(localMidnightUtc);
    const monthStart = new Date(Date.UTC(datePart("year"), datePart("month") - 1, 1, 3));
    const weekday = new Date(localMidnightUtc).getUTCDay();
    const weekStart = new Date(localMidnightUtc - ((weekday + 6) % 7) * 86400000);
    const scope: Prisma.OrderWhereInput = req.actor.role === "COMPANY" ? { companyId: req.actor.companyId } : {};
    const aggregateFor = async (from?: Date) => {
      const result = await prisma.order.aggregate({
        where: { ...scope, ...(from ? { createdAt: { gte: from, lte: now } } : {}) },
        _count: { _all: true },
        _sum: { price: true },
        _avg: { price: true },
      });
      return { orders: result._count._all, total: Number(result._sum.price ?? 0), average: Number(result._avg.price ?? 0) };
    };
    const [today, week, month, allTime] = await Promise.all([aggregateFor(dayStart), aggregateFor(weekStart), aggregateFor(monthStart), aggregateFor()]);
    res.json({ summary: { today, week, month, allTime, timezone: "America/Sao_Paulo" } });
  } catch (e) { next(e); }
});
api.get("/dashboard/charts", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || !["ADMIN", "COMPANY"].includes(req.actor.role)) throw new HttpError(403, "Acesso restrito");
    if (req.actor.role === "COMPANY" && !req.actor.companyId) throw new HttpError(403, "Empresa não identificada");
    const companyId = req.actor.role === "COMPANY" ? req.actor.companyId : undefined;
    res.json({ charts: await getDashboardCharts(companyId) });
  } catch (e) { next(e); }
});
api.post("/intelligence/ask", requireAuth, async (req, res, next) => {
  try {
    const access = resolveIntelligenceScope(req.actor);
    if (!access.allowed) throw new HttpError(403, "Acesso restrito");
    const { question } = intelligenceQuestionSchema.parse(req.body);
    const metrics = await getIntelligenceMetrics(access.companyId);
    res.json({ answer: answerIntelligenceQuestion(question, metrics), metrics });
  } catch (e) { next(e); }
});
api.get("/admin/whatsapp-requests", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); res.json({ requests: await prisma.whatsAppRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }) }); } catch (e) { next(e); } });
api.patch("/admin/whatsapp-requests/:id/status", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const data = whatsappRequestStatusSchema.parse(req.body); const request = await prisma.whatsAppRequest.update({ where: { id: String(req.params.id) }, data: { status: data.status } }); res.json({ request }); } catch (e) { next(e); } });
api.get("/admin/settings", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const rows = await prisma.setting.findMany({ where: { key: { in: ["companyName", "whatsappOperationsNumber", "supportPhone", "operationCity"] } } }); const values = Object.fromEntries(rows.map(row => [row.key, row.value])); res.json({ settings: { companyName: values.companyName ?? "Procópio Express", whatsappOperationsNumber: values.whatsappOperationsNumber ?? config.whatsappOperationsNumber, supportPhone: values.supportPhone ?? "", operationCity: values.operationCity ?? "Juiz de Fora", whatsappDeliveryMode: config.whatsappToken && config.whatsappPhoneNumberId ? "business_api" : "manual_fallback" } }); } catch (e) { next(e); } });
api.put("/admin/settings", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito"); const data = settingsSchema.parse(req.body); await prisma.$transaction(Object.entries(data).map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }))); res.json({ settings: { ...data, whatsappDeliveryMode: config.whatsappToken && config.whatsappPhoneNumberId ? "business_api" : "manual_fallback" } }); } catch (e) { next(e); } });
api.get("/company/settings", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "COMPANY" || !req.actor.companyId) throw new HttpError(403, "Empresa não identificada"); const company = await prisma.company.findUnique({ where: { id: req.actor.companyId } }); if (!company) throw new HttpError(404, "Empresa não encontrada"); const address = company.address as { text?: string; pickupAddress?: unknown } | null; res.json({ settings: { name: company.name, document: company.document ?? "", phone: company.phone ?? "", email: company.email ?? "", address: address?.text ?? "", pickupAddress: address?.pickupAddress ?? null } }); } catch (e) { next(e); } });
api.get("/company/customers", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || req.actor.role !== "COMPANY" || !req.actor.companyId) throw new HttpError(403, "Acesso restrito");
    const customers = await prisma.customer.findMany({
      where: { companyId: req.actor.companyId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: { _count: { select: { orders: true } }, orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    res.json({ customers: customers.map(({ orders, ...customer }) => ({ ...customer, lastOrderAt: orders[0]?.createdAt ?? null })) });
  } catch (e) { next(e); }
});
api.get("/company/orders", requireAuth, async (req, res, next) => { try { if (!req.actor || req.actor.role !== "COMPANY" || !req.actor.companyId) throw new HttpError(403, "Empresa não identificada"); res.json(await listOrders(req.query, { companyId: req.actor.companyId, allowCompanyFilter: false })); } catch (e) { next(e); } });
api.get("/courier/orders", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || req.actor.role !== "COURIER") throw new HttpError(403, "Acesso restrito")
    const courier = await prisma.courier.findUnique({
      where: { userId: req.actor.id },
      select: { id: true, active: true },
    })
    if (!courier || !courier.active) throw new HttpError(403, "Conta de motoboy inativa ou não cadastrada")
    res.json({
      orders: await prisma.order.findMany({
        where: { courierId: courier.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      }),
    })
  } catch (e) { next(e); }
})
api.patch("/courier/orders/:id/status", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || req.actor.role !== "COURIER") throw new HttpError(403, "Acesso restrito")
    const courierUserId = req.actor.id
    const { status } = courierOrderStatusSchema.parse(req.body)
    const courier = await prisma.courier.findUnique({
      where: { userId: courierUserId },
      select: { id: true, active: true },
    })
    if (!courier || !courier.active) throw new HttpError(403, "Conta de motoboy inativa ou não cadastrada")

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: String(req.params.id), courierId: courier.id },
        select: { id: true, publicId: true, status: true },
      })
      if (!order) throw new HttpError(404, "Pedido não encontrado para este motoboy")

      const nextStatus: Record<string, string> = {
        ASSIGNED: "PICKED_UP",
        PICKED_UP: "IN_TRANSIT",
        IN_TRANSIT: "DELIVERED",
      }
      if (nextStatus[order.status] !== status) {
        throw new HttpError(409, "Esta etapa não é permitida para o status atual do pedido")
      }

      const update = await tx.order.updateMany({
        where: { id: order.id, courierId: courier.id, status: order.status },
        data: { status },
      })
      if (update.count !== 1) {
        throw new HttpError(409, "O pedido foi atualizado por outra ação. Atualize a lista e tente novamente.")
      }
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      })
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status,
          changedById: courierUserId,
          note: "Atualizado pelo painel do motoboy.",
        },
      })
      return updated
    })

    res.json({ order: result })
  } catch (e) { next(e); }
});
api.patch("/admin/orders/:id/status", requireAuth, async (req, res, next) => {
  try {
    if (!req.actor || req.actor.role !== "ADMIN") throw new HttpError(403, "Acesso restrito")
    const adminUserId = req.actor.id
    const { status } = adminOrderStatusSchema.parse(req.body)
    const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
      PENDING: "CONFIRMED",
      FINALIZED: "CONFIRMED",
      CONFIRMED: "PICKED_UP",
      ASSIGNED: "PICKED_UP",
      PICKED_UP: "IN_TRANSIT",
      IN_TRANSIT: "DELIVERED",
    }

    const updated = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      })
      if (!order) throw new HttpError(404, "Pedido não encontrado")
      if (nextStatus[order.status] !== status) {
        throw new HttpError(409, "Esta etapa não é permitida para o status atual do pedido")
      }

      const result = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status },
      })
      if (result.count !== 1) {
        throw new HttpError(409, "O pedido foi atualizado por outra ação. Atualize a lista e tente novamente.")
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      })
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status,
          changedById: adminUserId,
          note: "Atualizado pelo painel administrativo.",
        },
      })
      return updatedOrder
    })

    res.json({ order: updated })
  } catch (e) { next(e); }
});
app.use("/api/v1", api);
app.use(notFound);
app.use(errorHandler);
export function start() { return app.listen(config.port, () => console.log(`API Procópio Express em http://localhost:${config.port}`)); }
