import { OrderStatus, Prisma, type CompanyPermission } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../middleware/errors.js";
import {
  addressSchema,
  companyBranchPickupAddressSchema,
  createOrderSchema,
  orderListQuerySchema,
} from "../validation.js";
import { getRoutePrice } from "./pricing.js";

export function assertCompanyCanCreateOrder(permission: CompanyPermission) {
  if (permission === "RESTRICTED") {
    throw new HttpError(403, "Seu perfil não tem permissão para registrar pedidos.");
  }
}

export function summarizeOrderStatuses(
  rows: Array<{ status: OrderStatus; count: number }>,
): Record<OrderStatus, number> {
  const counts: Record<OrderStatus, number> = {
    PENDING: 0,
    FINALIZED: 0,
    CONFIRMED: 0,
    ASSIGNED: 0,
    PICKED_UP: 0,
    IN_TRANSIT: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

export const ADMIN_ORDER_STATUS_TRANSITIONS: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  PENDING: "CONFIRMED",
  FINALIZED: "CONFIRMED",
  CONFIRMED: "PICKED_UP",
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export const COURIER_ORDER_STATUS_TRANSITIONS: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export function orderCompanyScope(
  options: { companyId?: string; allowCompanyFilter: boolean },
  requestedCompanyId?: string,
): Prisma.OrderWhereInput {
  const companyId =
    options.companyId ??
    (options.allowCompanyFilter ? requestedCompanyId : undefined);
  return companyId ? { companyId } : {};
}

export function buildOrderListQuery(
  rawQuery: unknown,
  options: { companyId?: string; allowCompanyFilter: boolean },
) {
  const query = orderListQuerySchema.parse(rawQuery);
  const where: Prisma.OrderWhereInput = orderCompanyScope(
    options,
    query.companyId,
  );
  if (query.status === "COMPLETED") {
    where.status = { in: ["FINALIZED", "DELIVERED"] };
  } else if (query.status) {
    where.status = query.status;
  }
  if (query.from || query.to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      const start = new Date(`${query.from}T03:00:00.000Z`);
      if (
        Number.isNaN(start.getTime()) ||
        start.toISOString().slice(0, 10) !== query.from
      ) {
        throw new HttpError(400, "Data inicial inválida.");
      }
      dateFilter.gte = start;
    }
    if (query.to) {
      const end = new Date(`${query.to}T03:00:00.000Z`);
      if (
        Number.isNaN(end.getTime()) ||
        end.toISOString().slice(0, 10) !== query.to
      ) {
        throw new HttpError(400, "Data final inválida.");
      }
      end.setUTCDate(end.getUTCDate() + 1);
      dateFilter.lt = end;
    }
    where.createdAt = dateFilter;
  }
  if (query.search) {
    where.OR = [
      { publicId: { contains: query.search, mode: "insensitive" } },
      { requesterName: { contains: query.search, mode: "insensitive" } },
      { recipientName: { contains: query.search, mode: "insensitive" } },
      { pickupNeighborhood: { contains: query.search, mode: "insensitive" } },
      { deliveryNeighborhood: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.neighborhood) {
    where.deliveryNeighborhood = {
      contains: query.neighborhood,
      mode: "insensitive",
    };
  }
  return {
    query,
    where,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

export async function createOrder(input: unknown, createdById?: string, companyId?: string) {
  const data = createOrderSchema.parse(input);
  const {
    pickupLocationId,
    pickupCustomerId,
    pickupCompanyAddress,
    deliveryLocationId,
    deliveryCustomerId,
    deliveryCompanyAddress,
    ...orderData
  } = data;
  let p = data.pickupAddress;
  let d = data.deliveryAddress;
  const hasSavedPickupSource = Boolean(
    pickupLocationId || pickupCustomerId || pickupCompanyAddress,
  );
  const hasSavedDeliverySource = Boolean(
    deliveryLocationId || deliveryCustomerId || deliveryCompanyAddress,
  );
  if ((hasSavedPickupSource || hasSavedDeliverySource) && !companyId) {
    throw new HttpError(400, "Endereços salvos só podem ser usados em pedidos empresariais.");
  }
  if (pickupLocationId && companyId) {
    const savedLocation = await prisma.companyBranch.findFirst({
      where: { id: pickupLocationId, companyId, isActive: true },
      select: { address: true },
    });
    if (!savedLocation) {
      throw new HttpError(404, "Endereço de coleta não encontrado ou inativo nesta empresa.");
    }
    const savedAddress = companyBranchPickupAddressSchema.safeParse(savedLocation.address);
    if (!savedAddress.success) {
      throw new HttpError(422, "O endereço salvo não possui os campos necessários para criar o pedido.");
    }
    p = { ...savedAddress.data, coordinates: data.pickupAddress.coordinates };
  }
  if (pickupCustomerId && companyId) {
    const savedCustomer = await prisma.customer.findFirst({
      where: { id: pickupCustomerId, companyId },
      select: { address: true },
    });
    if (!savedCustomer) {
      throw new HttpError(404, "Endereço de cliente não encontrado nesta empresa.");
    }
    const savedAddress = addressSchema.safeParse(savedCustomer.address);
    if (!savedAddress.success) {
      throw new HttpError(422, "O cliente salvo não possui os campos necessários para criar o pedido.");
    }
    p = {
      ...savedAddress.data,
      cidade: savedAddress.data.cidade || p.cidade,
      estado: savedAddress.data.estado || p.estado,
      coordinates: savedAddress.data.coordinates ?? data.pickupAddress.coordinates,
    };
  }
  if (deliveryLocationId && companyId) {
    const savedLocation = await prisma.companyBranch.findFirst({
      where: { id: deliveryLocationId, companyId, isActive: true },
      select: { address: true },
    });
    if (!savedLocation) {
      throw new HttpError(404, "Endereço de destino não encontrado ou inativo nesta empresa.");
    }
    const savedAddress = companyBranchPickupAddressSchema.safeParse(savedLocation.address);
    if (!savedAddress.success) {
      throw new HttpError(422, "O endereço de destino salvo não possui os campos necessários.");
    }
    d = { ...savedAddress.data, coordinates: data.deliveryAddress.coordinates };
  }
  if (deliveryCustomerId && companyId) {
    const savedCustomer = await prisma.customer.findFirst({
      where: { id: deliveryCustomerId, companyId },
      select: { address: true },
    });
    if (!savedCustomer) {
      throw new HttpError(404, "Endereço de destino não encontrado nesta empresa.");
    }
    const savedAddress = addressSchema.safeParse(savedCustomer.address);
    if (!savedAddress.success) {
      throw new HttpError(422, "O cliente salvo não possui os campos necessários para criar o destino.");
    }
    d = {
      ...savedAddress.data,
      cidade: savedAddress.data.cidade || d.cidade,
      estado: savedAddress.data.estado || d.estado,
      coordinates: savedAddress.data.coordinates ?? data.deliveryAddress.coordinates,
    };
  }
  if (deliveryCompanyAddress && companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { address: true },
    });
    const companyAddress = company?.address && typeof company.address === "object" && !Array.isArray(company.address)
      ? company.address.pickupAddress
      : null;
    const savedAddress = addressSchema.safeParse(companyAddress);
    if (!savedAddress.success) {
      throw new HttpError(422, "A empresa não possui um endereço de sede estruturado.");
    }
    d = {
      ...savedAddress.data,
      cidade: savedAddress.data.cidade || d.cidade,
      estado: savedAddress.data.estado || d.estado,
      coordinates: savedAddress.data.coordinates ?? data.deliveryAddress.coordinates,
    };
  }
  if (pickupCompanyAddress && companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { address: true },
    });
    const companyAddress = company?.address && typeof company.address === "object" && !Array.isArray(company.address)
      ? company.address.pickupAddress
      : null;
    const savedAddress = addressSchema.safeParse(companyAddress);
    if (!savedAddress.success) {
      throw new HttpError(422, "A empresa não possui um endereço de sede estruturado.");
    }
    p = {
      ...savedAddress.data,
      cidade: savedAddress.data.cidade || p.cidade,
      estado: savedAddress.data.estado || p.estado,
      coordinates: savedAddress.data.coordinates ?? data.pickupAddress.coordinates,
    };
  }
  const city = p.cidade || "Juiz de Fora";
  if (d.cidade && d.cidade.localeCompare(city, "pt-BR", { sensitivity: "base" }) !== 0) {
    throw new HttpError(422, "Coleta e entrega precisam estar na mesma cidade.");
  }
  const price = await getRoutePrice(city, p.bairro, d.bairro, p.coordinates, d.coordinates);
  if (data.customerId && !companyId) throw new HttpError(400, "Destinatários salvos só podem ser usados em pedidos empresariais.");
  if ((data.branchId || data.costCenterId) && !companyId) {
    throw new HttpError(400, "Filiais e centros de custo só podem ser usados em pedidos empresariais.");
  }
  return prisma.$transaction(async tx => {
    let customerId: string | undefined;
    if (companyId) {
      if (pickupLocationId && !await tx.companyBranch.findFirst({
        where: { id: pickupLocationId, companyId, isActive: true },
        select: { id: true },
      })) {
        throw new HttpError(404, "Endereço de coleta não encontrado ou inativo nesta empresa.");
      }
      if (pickupCustomerId && !await tx.customer.findFirst({
        where: { id: pickupCustomerId, companyId },
        select: { id: true },
      })) {
        throw new HttpError(404, "Endereço de cliente não encontrado nesta empresa.");
      }
      if (deliveryLocationId && !await tx.companyBranch.findFirst({
        where: { id: deliveryLocationId, companyId, isActive: true },
        select: { id: true },
      })) {
        throw new HttpError(404, "Endereço de destino não encontrado ou inativo nesta empresa.");
      }
      if (deliveryCustomerId && !await tx.customer.findFirst({
        where: { id: deliveryCustomerId, companyId },
        select: { id: true },
      })) {
        throw new HttpError(404, "Endereço de destino não encontrado nesta empresa.");
      }
      if (data.branchId && !await tx.companyBranch.findFirst({ where: { id: data.branchId, companyId, isActive: true } })) {
        throw new HttpError(404, "Filial não encontrada ou inativa nesta empresa.");
      }
      if (data.costCenterId && !await tx.companyCostCenter.findFirst({ where: { id: data.costCenterId, companyId, isActive: true } })) {
        throw new HttpError(404, "Centro de custo não encontrado ou inativo nesta empresa.");
      }
      const selectedCustomerId = deliveryCustomerId ?? data.customerId;
      let existing = selectedCustomerId
        ? await tx.customer.findFirst({ where: { id: selectedCustomerId, companyId } })
        : await tx.customer.findFirst({ where: { companyId, phone: data.recipientPhone } });
      if (selectedCustomerId && !existing) throw new HttpError(404, "Destinatário não encontrado nesta empresa.");
      if (!selectedCustomerId && !existing) {
        const customers = await tx.customer.findMany({ where: { companyId }, select: { id: true, phone: true } });
        const match = customers.find(customer => customer.phone?.replace(/\D/g, "") === data.recipientPhone.replace(/\D/g, ""));
        existing = match ? await tx.customer.findUnique({ where: { id: match.id } }) : null;
      }
      const recipientAddress = d as Prisma.InputJsonValue;
      const customer = existing
        ? await tx.customer.update({ where: { id: existing.id }, data: { name: data.recipientName, phone: data.recipientPhone, address: recipientAddress } })
        : await tx.customer.create({ data: { companyId, name: data.recipientName, phone: data.recipientPhone, address: recipientAddress } });
      customerId = customer.id;
    }
    return tx.order.create({ data: { ...orderData, pickupAddress: p as Prisma.InputJsonValue, customerId,
      price: price.pricingType === "FIXED" || price.pricingType === "PER_KM" ? price.price : null,
      distance: price.distanceKm,
      perKmRate: price.perKmRate,
      pricingType: price.pricingType,
      minimumPrice: price.minimumPrice,
      maximumPrice: price.maximumPrice,
      priceTableName: price.priceTable,
      priceTableId: price.priceTableId,
      pricingRouteId: price.pricingRouteId,
      deliveryAddress: d as Prisma.InputJsonValue,
      pickupCep:p.cep, pickupStreet:p.rua, pickupNumber:p.numero, pickupNeighborhood:p.bairro, pickupComplement:p.complemento, pickupCity:p.cidade, pickupState:p.estado,
      deliveryCep:d.cep, deliveryStreet:d.rua, deliveryNumber:d.numero, deliveryNeighborhood:d.bairro, deliveryComplement:d.complemento, deliveryCity:d.cidade, deliveryState:d.estado,
      pickupLatitude:p.coordinates?.latitude, pickupLongitude:p.coordinates?.longitude, deliveryLatitude:d.coordinates?.latitude, deliveryLongitude:d.coordinates?.longitude,
      requesterName: data.requesterName,
      requesterPhone: data.requesterPhone,
      companyId,
      createdById, status: OrderStatus.FINALIZED, history: { create: { status: OrderStatus.FINALIZED, note: "Pedido finalizado no site e registrado para controle." } } }, include: { history: true, company: { select: { name: true } } } });
  });
}
export function publicOrder(order: any) { return { publicId: order.publicId, status: order.status, price: order.price, recipientName: order.recipientName, history: order.history }; }
export async function getPublicOrder(id: string, token?: string) {
  if (!token) throw new HttpError(401, "Token de acompanhamento obrigatório");
  const order = await prisma.order.findFirst({ where: { publicId: id, trackingToken: token }, include: { history: { orderBy: { createdAt: "asc" } } } });
  if (!order) throw new HttpError(404, "Pedido não encontrado");
  return publicOrder(order);
}
