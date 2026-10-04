import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../middleware/errors.js";
import { createOrderSchema } from "../validation.js";
import { getRoutePrice } from "./pricing.js";

export async function createOrder(input: unknown, createdById?: string, companyId?: string) {
  const data = createOrderSchema.parse(input);
  const p = data.pickupAddress, d = data.deliveryAddress;
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
      if (data.branchId && !await tx.companyBranch.findFirst({ where: { id: data.branchId, companyId, isActive: true } })) {
        throw new HttpError(404, "Filial não encontrada ou inativa nesta empresa.");
      }
      if (data.costCenterId && !await tx.companyCostCenter.findFirst({ where: { id: data.costCenterId, companyId, isActive: true } })) {
        throw new HttpError(404, "Centro de custo não encontrado ou inativo nesta empresa.");
      }
      let existing = data.customerId
        ? await tx.customer.findFirst({ where: { id: data.customerId, companyId } })
        : await tx.customer.findFirst({ where: { companyId, phone: data.recipientPhone } });
      if (data.customerId && !existing) throw new HttpError(404, "Destinatário não encontrado nesta empresa.");
      if (!data.customerId && !existing) {
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
    return tx.order.create({ data: { ...data, customerId,
      price: price.pricingType === "FIXED" || price.pricingType === "PER_KM" ? price.price : null,
      distance: price.distanceKm,
      perKmRate: price.perKmRate,
      pricingType: price.pricingType,
      minimumPrice: price.minimumPrice,
      maximumPrice: price.maximumPrice,
      priceTableName: price.priceTable,
      priceTableId: price.priceTableId,
      pricingRouteId: price.pricingRouteId,
      pickupAddress: p as Prisma.InputJsonValue, deliveryAddress: d as Prisma.InputJsonValue,
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
