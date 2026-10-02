import { Prisma } from "@prisma/client";
import express, { type Request, type RequestHandler, type Response } from "express";
import {
  companyBranchSchema,
  companyCostCenterSchema,
  companyMemberSchema,
  companyMemberUpdateSchema,
  financialEntrySchema,
  leadSchema,
  planSchema,
  priceTableDestinationSchema,
  priceTableImportSchema,
  priceTableOriginSchema,
  priceTableSchema,
  subscriptionSchema,
  subscriptionUpdateSchema,
  systemUserActiveSchema,
  systemUserSchema,
} from "../validation.js";
import { hashPassword } from "../auth.js";
import { config, databaseConfigured } from "../config.js";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { normalizeName } from "../services/normalization.js";
import { companySettingsSchema } from "../validation.js";

const adminRouter = express.Router();
const companyRouter = express.Router();

const route = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };

const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.actor?.role !== "ADMIN") return next(new HttpError(403, "Acesso restrito"));
  next();
};

const requireCompany: RequestHandler = (req, _res, next) => {
  if (req.actor?.role !== "COMPANY" || !req.actor.companyId) {
    return next(new HttpError(403, "Acesso restrito a usuários de empresa"));
  }
  next();
};

const companyId = (req: Request) => {
  if (!req.actor?.companyId) throw new HttpError(403, "Empresa não identificada");
  return req.actor.companyId;
};

async function audit(req: Request, action: string, entity: string, entityId?: string, details?: Prisma.InputJsonValue) {
  const actor = await prisma.user.findUnique({ where: { id: req.actor!.id }, select: { name: true } });
  await prisma.auditLog.create({
    data: {
      actorId: req.actor!.id,
      actorName: actor?.name ?? "Usuário removido",
      action,
      entity,
      entityId,
      details,
    },
  });
}

async function requireCompanyAdmin(req: Request) {
  const id = companyId(req);
  const user = await prisma.user.findUnique({
    where: { id: req.actor!.id },
    select: { companyPermission: true, isActive: true },
  });
  if (!user?.isActive) throw new HttpError(403, "Usuário inativo");
  if (user.companyPermission !== "ADMIN") throw new HttpError(403, "Apenas administradores da empresa podem fazer esta alteração");
  return id;
}

adminRouter.use(requireAuth, requireAdmin);
companyRouter.use(requireAuth, requireCompany);

adminRouter.get("/leads", route(async (_req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
  res.json({ leads });
}));

adminRouter.post("/leads", route(async (req, res) => {
  const data = leadSchema.parse(req.body);
  const lead = await prisma.lead.create({ data });
  await audit(req, "CREATE", "Lead", lead.id);
  res.status(201).json({ lead });
}));

adminRouter.patch("/leads/:id", route(async (req, res) => {
  const data = leadSchema.partial().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  const lead = await prisma.lead.update({ where: { id: String(req.params.id) }, data });
  await audit(req, "UPDATE", "Lead", lead.id, { stage: lead.stage });
  res.json({ lead });
}));

adminRouter.get("/plans", route(async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });
  res.json({ plans });
}));

adminRouter.post("/plans", route(async (req, res) => {
  const data = planSchema.parse(req.body);
  const plan = await prisma.plan.create({ data });
  await audit(req, "CREATE", "Plan", plan.id);
  res.status(201).json({ plan });
}));

adminRouter.patch("/plans/:id", route(async (req, res) => {
  const data = planSchema.partial().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  const plan = await prisma.plan.update({ where: { id: String(req.params.id) }, data });
  await audit(req, "UPDATE", "Plan", plan.id);
  res.json({ plan });
}));

adminRouter.get("/subscriptions", route(async (_req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: { company: { select: { id: true, name: true } }, plan: { select: { id: true, name: true } } },
  });
  res.json({ subscriptions });
}));

adminRouter.post("/subscriptions", route(async (req, res) => {
  const data = subscriptionSchema.parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!plan || !plan.isActive) throw new HttpError(404, "Plano ativo não encontrado");
  const company = await prisma.company.findUnique({ where: { id: data.companyId }, select: { id: true } });
  if (!company) throw new HttpError(404, "Empresa não encontrada");
  const subscription = await prisma.$transaction(async (tx) => {
    if (data.status === "ACTIVE") {
      await tx.subscription.updateMany({
        where: { companyId: data.companyId, status: "ACTIVE" },
        data: { status: "INACTIVE", endedAt: new Date() },
      });
    }
    return tx.subscription.create({
      data: {
        companyId: data.companyId,
        planId: data.planId,
        status: data.status,
        monthlyPrice: data.monthlyPrice ?? plan.monthlyPrice,
        startedAt: data.startedAt,
        renewalAt: data.renewalAt,
      },
      include: { company: { select: { id: true, name: true } }, plan: { select: { id: true, name: true } } },
    });
  });
  await audit(req, "CREATE", "Subscription", subscription.id, { companyId: subscription.companyId, planId: subscription.planId });
  res.status(201).json({ subscription });
}));

adminRouter.patch("/subscriptions/:id", route(async (req, res) => {
  const data = subscriptionUpdateSchema.parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  const subscription = await prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({ where: { id: String(req.params.id) } });
    if (!current) throw new HttpError(404, "Assinatura não encontrada");
    if (data.status === "ACTIVE") {
      await tx.subscription.updateMany({
        where: { companyId: current.companyId, status: "ACTIVE", id: { not: current.id } },
        data: { status: "INACTIVE", endedAt: new Date() },
      });
    }
    const updated = await tx.subscription.update({
      where: { id: current.id },
      data: { ...data, ...(data.status === "INACTIVE" ? { endedAt: new Date() } : {}) },
      include: { company: { select: { id: true, name: true } }, plan: { select: { id: true, name: true } } },
    });
    return updated;
  });
  await audit(req, "UPDATE", "Subscription", subscription.id, { status: subscription.status });
  res.json({ subscription });
}));

adminRouter.get("/financial-entries", route(async (_req, res) => {
  const entries = await prisma.financialEntry.findMany({
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: { company: { select: { id: true, name: true } } },
  });
  res.json({ entries });
}));

adminRouter.post("/financial-entries", route(async (req, res) => {
  const data = financialEntrySchema.parse(req.body);
  if (data.companyId && !await prisma.company.findUnique({ where: { id: data.companyId }, select: { id: true } })) {
    throw new HttpError(404, "Empresa não encontrada");
  }
  const entry = await prisma.financialEntry.create({
    data,
    include: { company: { select: { id: true, name: true } } },
  });
  await audit(req, "CREATE", "FinancialEntry", entry.id, { type: entry.type, amount: Number(entry.amount) });
  res.status(201).json({ entry });
}));

adminRouter.get("/financial-summary", route(async (_req, res) => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = new Date(Date.UTC(year, month - 6, 1, 3));
  const entries = await prisma.financialEntry.findMany({
    where: { occurredAt: { gte: start, lt: new Date(Date.UTC(year, month, 1, 3)) } },
    select: { type: true, amount: true, occurredAt: true },
  });
  const totals = new Map<string, { month: string; income: number; expenses: number }>();
  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(Date.UTC(year, month - 6 + offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    totals.set(key, { month: key, income: 0, expenses: 0 });
  }
  for (const entry of entries) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(entry.occurredAt);
    const total = totals.get(key);
    if (!total) continue;
    if (entry.type === "INCOME") total.income += Number(entry.amount);
    else total.expenses += Number(entry.amount);
  }
  res.json({ months: [...totals.values()] });
}));

adminRouter.get("/audit-logs", route(async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  res.json({ logs });
}));

adminRouter.get("/system-users", route(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { name: "ADMIN" } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
  });
  res.json({ users });
}));

adminRouter.post("/system-users", route(async (req, res) => {
  const data = systemUserSchema.parse(req.body);
  const email = data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new HttpError(409, "Já existe uma conta com este e-mail");
  }
  const role = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (!role) throw new HttpError(500, "Perfil de administrador não está configurado");
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      phone: data.phone,
      passwordHash: await hashPassword(data.password),
      roleId: role.id,
      isActive: true,
    },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
  });
  await audit(req, "CREATE", "User", user.id, { email: user.email });
  res.status(201).json({ user });
}));

adminRouter.patch("/system-users/:id", route(async (req, res) => {
  const data = systemUserActiveSchema.parse(req.body);
  const id = String(req.params.id);
  const user = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id, role: { name: "ADMIN" } }, select: { id: true } });
    if (!target) throw new HttpError(404, "Administrador não encontrado");
    if (req.actor?.id === id && !data.isActive) throw new HttpError(400, "Não é possível desativar seu próprio usuário");
    if (!data.isActive) {
      const activeAdmins = await tx.user.count({ where: { role: { name: "ADMIN" }, isActive: true } });
      if (activeAdmins <= 1) throw new HttpError(409, "O sistema precisa manter ao menos um administrador ativo");
    }
    return tx.user.update({
      where: { id },
      data: { isActive: data.isActive },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "UPDATE", "User", user.id, { isActive: user.isActive });
  res.json({ user });
}));

adminRouter.get("/integrations", route(async (_req, res) => {
  const whatsappConfigured = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const routingConfigured = config.perKmPricingEnabled && Boolean(config.routingApiUrl);
  res.json({
    integrations: [
      {
        id: "database",
        name: "Banco de dados",
        description: "Persistência PostgreSQL usada pela aplicação.",
        status: databaseConfigured ? "ACTIVE" : "SETUP_REQUIRED",
        note: databaseConfigured ? "Conexão configurada no servidor." : "Configure DATABASE_URL no backend.",
      },
      {
        id: "whatsapp",
        name: "WhatsApp Business",
        description: "Notificações operacionais pelo WhatsApp Business Platform.",
        status: whatsappConfigured ? "ACTIVE" : "SETUP_REQUIRED",
        note: whatsappConfigured ? "Credenciais da Meta configuradas." : "Configure as credenciais e o webhook da Meta.",
      },
      {
        id: "routing",
        name: "Cálculo por KM (opcional)",
        description: "Distância rodoviária para tarifas configuradas por quilômetro.",
        status: !config.perKmPricingEnabled ? "NOT_AVAILABLE" : routingConfigured ? "ACTIVE" : "SETUP_REQUIRED",
        note: !config.perKmPricingEnabled
          ? "Opcional e desativado; o valor é consultado pelo atendimento."
          : routingConfigured
            ? "Endpoint de rotas configurado no servidor."
            : "Configure ROUTING_API_URL com um endpoint compatível com OSRM.",
      },
      {
        id: "email",
        name: "E-mail",
        description: "Envio de notificações e recuperação de senha.",
        status: "NOT_AVAILABLE",
        note: "O envio de e-mail ainda não está implementado.",
      },
    ],
  });
}));

adminRouter.get("/price-tables", route(async (_req, res) => {
  const tables = await prisma.priceTable.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      origins: { orderBy: { originName: "asc" } },
      destinations: { orderBy: { destinationName: "asc" } },
    },
  });
  res.json({ tables });
}));

adminRouter.post("/price-tables", route(async (req, res) => {
  const data = priceTableSchema.parse(req.body);
  const duplicate = await prisma.priceTable.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
  if (duplicate) throw new HttpError(409, "Já existe uma tabela com esse nome");
  const table = await prisma.priceTable.create({ data: { name: data.name, description: data.description } });
  await audit(req, "CREATE", "PriceTable", table.id);
  res.status(201).json({ table: { ...table, origins: [], destinations: [] } });
}));

adminRouter.patch("/price-tables/:id", route(async (req, res) => {
  const data = priceTableSchema.partial().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  if (data.name) {
    const duplicate = await prisma.priceTable.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" }, id: { not: String(req.params.id) } },
    });
    if (duplicate) throw new HttpError(409, "Já existe uma tabela com esse nome");
  }
  const table = await prisma.priceTable.update({ where: { id: String(req.params.id) }, data });
  await audit(req, "UPDATE", "PriceTable", table.id);
  res.json({ table });
}));

adminRouter.post("/price-tables/:tableId/origins", route(async (req, res) => {
  const data = priceTableOriginSchema.parse(req.body);
  const priceTableId = String(req.params.tableId);
  const table = await prisma.priceTable.findUnique({ where: { id: priceTableId }, select: { id: true } });
  if (!table) throw new HttpError(404, "Tabela de preços não encontrada");
  const normalizedOriginName = normalizeName(data.originName);
  const duplicate = await prisma.priceTableOrigin.findFirst({
    where: { priceTableId, normalizedOriginName },
  });
  if (duplicate) throw new HttpError(409, "Essa origem já está cadastrada na tabela");
  const origin = await prisma.priceTableOrigin.create({ data: { ...data, priceTableId, normalizedOriginName } });
  await audit(req, "CREATE", "PriceTableOrigin", origin.id, { priceTableId });
  res.status(201).json({ origin });
}));

adminRouter.patch("/price-tables/:tableId/origins/:id", route(async (req, res) => {
  const data = priceTableOriginSchema.partial().parse(req.body);
  const priceTableId = String(req.params.tableId);
  const id = String(req.params.id);
  const current = await prisma.priceTableOrigin.findFirst({ where: { id, priceTableId } });
  if (!current) throw new HttpError(404, "Origem não encontrada nesta tabela");
  const normalizedOriginName = data.originName ? normalizeName(data.originName) : current.normalizedOriginName;
  const duplicate = await prisma.priceTableOrigin.findFirst({
    where: { id: { not: id }, priceTableId, normalizedOriginName },
  });
  if (duplicate) throw new HttpError(409, "Essa origem já está cadastrada na tabela");
  const origin = await prisma.priceTableOrigin.update({
    where: { id },
    data: { ...data, normalizedOriginName },
  });
  await audit(req, "UPDATE", "PriceTableOrigin", origin.id, { active: origin.active });
  res.json({ origin });
}));

adminRouter.delete("/price-tables/:tableId/origins/:id", route(async (req, res) => {
  const id = String(req.params.id);
  const origin = await prisma.priceTableOrigin.findFirst({ where: { id, priceTableId: String(req.params.tableId) } });
  if (!origin) throw new HttpError(404, "Origem não encontrada nesta tabela");
  const updated = await prisma.priceTableOrigin.update({ where: { id }, data: { active: false } });
  await audit(req, "DEACTIVATE", "PriceTableOrigin", id);
  res.json({ origin: updated });
}));

async function saveDestination(priceTableId: string, input: unknown, id?: string) {
  const data = priceTableDestinationSchema.parse(input);
  const normalizedDestinationName = normalizeName(data.destinationName);
  const current = id ? await prisma.priceTableDestination.findFirst({ where: { id, priceTableId } }) : null;
  if (id && !current) throw new HttpError(404, "Destino não encontrado nesta tabela");
  const duplicate = await prisma.priceTableDestination.findFirst({
    where: { priceTableId, normalizedDestinationName, ...(id ? { id: { not: id } } : {}) },
  });
  if (duplicate) throw new HttpError(409, "Esse destino já está cadastrado na tabela");
  const pricing = data.pricingType === "FIXED"
    ? { fixedPrice: data.fixedPrice, minimumPrice: null, maximumPrice: null, perKmRate: null }
    : data.pricingType === "RANGE"
      ? { fixedPrice: null, minimumPrice: data.minimumPrice, maximumPrice: data.maximumPrice, perKmRate: null }
      : data.pricingType === "PER_KM"
        ? { fixedPrice: null, minimumPrice: null, maximumPrice: null, perKmRate: data.perKmRate ?? null }
        : { fixedPrice: null, minimumPrice: null, maximumPrice: null, perKmRate: null };
  return id
    ? prisma.priceTableDestination.update({
        where: { id },
        data: { destinationName: data.destinationName, normalizedDestinationName, pricingType: data.pricingType, ...pricing, ...(data.active !== undefined ? { active: data.active } : {}) },
      })
    : prisma.priceTableDestination.create({
        data: { priceTableId, destinationName: data.destinationName, normalizedDestinationName, pricingType: data.pricingType, ...pricing, active: data.active },
      });
}

adminRouter.post("/price-tables/:tableId/destinations", route(async (req, res) => {
  const priceTableId = String(req.params.tableId);
  if (!await prisma.priceTable.findUnique({ where: { id: priceTableId }, select: { id: true } })) {
    throw new HttpError(404, "Tabela de preços não encontrada");
  }
  const destination = await saveDestination(priceTableId, req.body);
  await audit(req, "CREATE", "PriceTableDestination", destination.id, { priceTableId });
  res.status(201).json({ destination });
}));

adminRouter.put("/price-tables/:tableId/destinations/:id", route(async (req, res) => {
  const destination = await saveDestination(String(req.params.tableId), req.body, String(req.params.id));
  await audit(req, "UPDATE", "PriceTableDestination", destination.id);
  res.json({ destination });
}));

adminRouter.patch("/price-tables/:tableId/destinations/:id", route(async (req, res) => {
  const { active } = req.body as { active?: unknown };
  if (typeof active !== "boolean") throw new HttpError(400, "Informe um status válido");
  const id = String(req.params.id);
  const current = await prisma.priceTableDestination.findFirst({ where: { id, priceTableId: String(req.params.tableId) } });
  if (!current) throw new HttpError(404, "Destino não encontrado nesta tabela");
  const destination = await prisma.priceTableDestination.update({ where: { id }, data: { active } });
  await audit(req, active ? "ACTIVATE" : "DEACTIVATE", "PriceTableDestination", id);
  res.json({ destination });
}));

adminRouter.post("/price-tables/:tableId/import", route(async (req, res) => {
  const data = priceTableImportSchema.parse(req.body);
  const priceTableId = String(req.params.tableId);
  if (!await prisma.priceTable.findUnique({ where: { id: priceTableId }, select: { id: true } })) {
    throw new HttpError(404, "Tabela de preços não encontrada");
  }
  const imported = await prisma.$transaction(async (tx) => {
    for (const destination of data.destinations) {
      const normalizedDestinationName = normalizeName(destination.destinationName);
      const values = destination.pricingType === "FIXED"
        ? { fixedPrice: destination.fixedPrice, minimumPrice: null, maximumPrice: null, perKmRate: null }
        : destination.pricingType === "RANGE"
          ? { fixedPrice: null, minimumPrice: destination.minimumPrice, maximumPrice: destination.maximumPrice, perKmRate: null }
          : destination.pricingType === "PER_KM"
            ? { fixedPrice: null, minimumPrice: null, maximumPrice: null, perKmRate: destination.perKmRate ?? null }
            : { fixedPrice: null, minimumPrice: null, maximumPrice: null, perKmRate: null };
      await tx.priceTableDestination.upsert({
        where: { priceTableId_normalizedDestinationName: { priceTableId, normalizedDestinationName } },
        create: {
          priceTableId,
          destinationName: destination.destinationName,
          normalizedDestinationName,
          pricingType: destination.pricingType,
          ...values,
          active: destination.active ?? true,
        },
        update: {
          destinationName: destination.destinationName,
          pricingType: destination.pricingType,
          ...values,
          active: destination.active ?? true,
        },
      });
    }
    return data.destinations.length;
  });
  await audit(req, "IMPORT", "PriceTableDestination", priceTableId, { imported });
  res.json({ imported });
}));

companyRouter.get("/organization", route(async (req, res) => {
  const id = companyId(req);
  const [company, members, branches, costCenters, subscription] = await Promise.all([
    prisma.company.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { companyId: id, role: { name: "COMPANY" } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { role: { select: { name: true } } },
    }),
    prisma.companyBranch.findMany({ where: { companyId: id }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.companyCostCenter.findMany({ where: { companyId: id }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.subscription.findFirst({
      where: { companyId: id, status: { in: ["ACTIVE", "OVERDUE"] } },
      orderBy: { startedAt: "desc" },
      include: { plan: { select: { id: true, name: true } } },
    }),
  ]);
  if (!company) throw new HttpError(404, "Empresa não encontrada");
  const address = company.address && typeof company.address === "object" && !Array.isArray(company.address)
    ? company.address as Prisma.JsonObject
    : {};
  res.json({
    organization: {
      company: {
        id: company.id,
        name: company.name,
        document: company.document ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        address: typeof address.text === "string" ? address.text : "",
      },
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role.name,
        companyPermission: member.companyPermission,
        isActive: member.isActive,
      })),
      branches: branches.map((branch) => ({
        ...branch,
        address: branch.address && typeof branch.address === "object" && !Array.isArray(branch.address)
          ? branch.address
          : branch.address ? { text: String(branch.address) } : null,
      })),
      costCenters,
      subscription,
    },
  });
}));

companyRouter.put("/settings", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companySettingsSchema.parse(req.body);
  const addressText = data.address.trim();
  const company = await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      document: data.document || null,
      phone: data.phone || null,
      email: data.email || null,
      address: { text: addressText, pickupAddress: data.pickupAddress },
    },
  });
  await audit(req, "UPDATE", "Company", id);
  res.json({
    settings: {
      name: company.name,
      document: company.document ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      address: addressText,
      pickupAddress: data.pickupAddress,
    },
  });
}));

companyRouter.post("/members", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companyMemberSchema.parse(req.body);
  const email = data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new HttpError(409, "Já existe uma conta com este e-mail");
  }
  const role = await prisma.role.findUnique({ where: { name: "COMPANY" } });
  if (!role) throw new HttpError(500, "Perfil de empresa não está configurado");
  const member = await prisma.user.create({
    data: {
      name: data.name,
      email,
      phone: data.phone,
      passwordHash: await hashPassword(data.password),
      roleId: role.id,
      companyId: id,
      companyPermission: data.companyPermission,
      isActive: true,
    },
    include: { role: { select: { name: true } } },
  });
  await audit(req, "CREATE", "CompanyMember", member.id, { companyId: id });
  res.status(201).json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role.name,
      companyPermission: member.companyPermission,
      isActive: member.isActive,
    },
  });
}));

companyRouter.patch("/members/:id", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const targetId = String(req.params.id);
  const data = companyMemberUpdateSchema.parse(req.body);
  const member = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: targetId, companyId: id, role: { name: "COMPANY" } },
    });
    if (!target) throw new HttpError(404, "Usuário não encontrado nesta empresa");
    if (target.id === req.actor!.id && (data.isActive === false || data.companyPermission === "RESTRICTED" || data.companyPermission === "STANDARD")) {
      throw new HttpError(400, "Não é possível remover sua própria permissão de administrador");
    }
    const removingAdmin = target.companyPermission === "ADMIN" && (data.isActive === false || (data.companyPermission && data.companyPermission !== "ADMIN"));
    if (removingAdmin) {
      const adminCount = await tx.user.count({
        where: { companyId: id, isActive: true, companyPermission: "ADMIN", role: { name: "COMPANY" } },
      });
      if (adminCount <= 1) throw new HttpError(409, "A empresa precisa manter ao menos um administrador ativo");
    }
    return tx.user.update({
      where: { id: targetId },
      data,
      include: { role: { select: { name: true } } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "UPDATE", "CompanyMember", member.id, { companyPermission: member.companyPermission, isActive: member.isActive });
  res.json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role.name,
      companyPermission: member.companyPermission,
      isActive: member.isActive,
    },
  });
}));

companyRouter.post("/branches", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companyBranchSchema.parse(req.body);
  const branch = await prisma.companyBranch.create({
    data: {
      companyId: id,
      name: data.name,
      phone: data.phone,
      address: data.address ? { text: data.address } : Prisma.JsonNull,
    },
  });
  await audit(req, "CREATE", "CompanyBranch", branch.id, { companyId: id });
  res.status(201).json({ branch });
}));

companyRouter.patch("/branches/:id", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companyBranchSchema.partial().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  const branchId = String(req.params.id);
  const current = await prisma.companyBranch.findFirst({ where: { id: branchId, companyId: id } });
  if (!current) throw new HttpError(404, "Filial não encontrada nesta empresa");
  const branch = await prisma.companyBranch.update({
    where: { id: branchId },
    data: {
      name: data.name,
      phone: data.phone,
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.address !== undefined ? { address: data.address ? { text: data.address } : Prisma.JsonNull } : {}),
    },
  });
  await audit(req, "UPDATE", "CompanyBranch", branch.id, { isActive: branch.isActive });
  res.json({ branch });
}));

companyRouter.post("/cost-centers", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companyCostCenterSchema.parse(req.body);
  const costCenter = await prisma.companyCostCenter.create({
    data: { companyId: id, name: data.name, code: data.code },
  });
  await audit(req, "CREATE", "CompanyCostCenter", costCenter.id, { companyId: id });
  res.status(201).json({ costCenter });
}));

companyRouter.patch("/cost-centers/:id", route(async (req, res) => {
  const id = await requireCompanyAdmin(req);
  const data = companyCostCenterSchema.partial().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, "Informe ao menos um campo para atualizar");
  const costCenterId = String(req.params.id);
  if (!await prisma.companyCostCenter.findFirst({ where: { id: costCenterId, companyId: id } })) {
    throw new HttpError(404, "Centro de custo não encontrado nesta empresa");
  }
  const costCenter = await prisma.companyCostCenter.update({ where: { id: costCenterId }, data });
  await audit(req, "UPDATE", "CompanyCostCenter", costCenter.id, { isActive: costCenter.isActive });
  res.json({ costCenter });
}));

export { adminRouter, companyRouter };
