import type { Order } from "@prisma/client"

type OrderMessageData = Pick<
  Order,
  | "companyId"
  | "deliveryAddress"
  | "publicId"
  | "recipientName"
  | "recipientPhone"
  | "requesterName"
  | "requesterPhone"
  | "pickupAddress"
> & {
  company: { name: string } | null
}

export type NewOrderWhatsAppData = OrderMessageData

type Address = {
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
}

function formatAddress(value: Order["pickupAddress"]) {
  const address = value as Address
  const street = [address.rua, address.numero].filter(Boolean).join(", ")
  const neighborhood = [address.bairro, address.cidade, address.estado]
    .filter(Boolean)
    .join(" - ")

  return [
    street,
    address.complemento,
    neighborhood,
    address.cep ? `CEP ${address.cep}` : undefined,
  ]
    .filter(Boolean)
    .join(", ")
}

export function buildNewOrderWhatsAppMessage(order: OrderMessageData) {
  const [publicId, requesterOrCompany, recipientName, deliveryAddress, recipientPhone] =
    buildNewOrderWhatsAppTemplateParameters(order)
  const lines = [
    "🚨 NOVO PEDIDO — PROCÓPIO EXPRESS",
    "",
    `Pedido: #${publicId}`,
    "",
  ]

  if (order.companyId) {
    lines.push(`🏢 EMPRESA: ${order.company?.name ?? "Não identificada"}`)
  } else {
    lines.push(`👤 ${requesterOrCompany}`)
  }

  lines.push(
    "",
    "📦 ENTREGA:",
    `👤 Recebedor: ${recipientName}`,
    `📱 Telefone: ${recipientPhone}`,
    deliveryAddress,
  )

  return lines.join("\n")
}

export function buildNewOrderWhatsAppTemplateParameters(
  order: OrderMessageData,
): [string, string, string, string, string] {
  const requesterOrCompany = order.companyId
    ? `Empresa: ${order.company?.name ?? "Não identificada"}`
    : [
        `Solicitante: ${order.requesterName ?? "Não informado"}`,
        `Telefone: ${order.requesterPhone ?? "Não informado"}`,
        `Coleta: ${formatAddress(order.pickupAddress) || "Endereço não informado"}`,
      ].join("\n")

  return [
    order.publicId,
    requesterOrCompany,
    order.recipientName,
    formatAddress(order.deliveryAddress) || "Endereço não informado",
    order.recipientPhone ?? "Não informado",
  ]
}
