import type { Order } from "@prisma/client";
import { prisma } from "../db.js";
import { config } from "../config.js";

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function orderMessage(order: Pick<Order, "publicId" | "requesterName" | "requesterPhone" | "recipientName" | "recipientPhone" | "pickupAddress" | "deliveryAddress" | "notes" | "price" | "createdAt">) {
  const pickup = order.pickupAddress as { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string };
  const delivery = order.deliveryAddress as { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string };
  const pickupText = [pickup.rua, pickup.numero, pickup.bairro].filter(Boolean).join(", ");
  const deliveryText = [delivery.rua, delivery.numero, delivery.bairro].filter(Boolean).join(", ");
  const price = `R$ ${Number(order.price).toFixed(2).replace(".", ",")}`;
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(order.createdAt);
  return [
    "🚨 NOVO PEDIDO — PROCÓPIO EXPRESS",
    "",
    `Pedido: #${order.publicId}`,
    "",
    "👤 CLIENTE:",
    order.requesterName ?? "Não informado",
    `📱 Telefone: ${order.requesterPhone ?? "Não informado"}`,
    "",
    "📍 COLETA:",
    [pickupText, pickup.complemento, pickup.cidade].filter(Boolean).join(", "),
    "",
    "📦 ENTREGA:",
    [deliveryText, delivery.complemento, delivery.cidade].filter(Boolean).join(", "),
    `👤 Recebedor: ${order.recipientName}${order.recipientPhone ? ` · ${order.recipientPhone}` : ""}`,
    "",
    `📝 Observação: ${order.notes?.trim() || "Nenhuma"}`,
    "",
    `💰 Valor: ${price}`,
    `🕒 Horário do pedido: ${time}`,
  ].join("\n");
}

async function sendBusinessMessage(recipient: string, message: string) {
  if (!config.whatsappToken || !config.whatsappPhoneNumberId) {
    return { sentAt: null, provider: "fallback" as const };
  }
  const response = await fetch(`https://graph.facebook.com/v22.0/${config.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body: message } }),
  });
  if (!response.ok) throw new Error(`WhatsApp Business API respondeu ${response.status}`);
  return { sentAt: new Date(), provider: "business" as const };
}

async function getSetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return typeof setting?.value === "string" ? setting.value : undefined;
}

export async function notifyNewOrder(order: Order) {
  const configuredRecipient = (await getSetting("whatsappOperationsNumber")) || config.whatsappOperationsNumber;
  const recipient = configuredRecipient ? normalizePhoneNumber(configuredRecipient) : "";
  if (!recipient) return { status: "not_configured" as const, fallbackUrl: undefined };
  const message = orderMessage(order);
  const fallbackUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  let notification;
  try {
    notification = await prisma.notification.create({ data: { orderId: order.id, channel: "WHATSAPP", recipient, message } });
  } catch (error) {
    console.error("Pedido salvo, mas não foi possível registrar a notificação do WhatsApp", error);
    return { status: "failed" as const, fallbackUrl };
  }
  try {
    const result = await sendBusinessMessage(recipient, message);
    if (result.provider === "fallback") {
      return { status: "pending" as const, fallbackUrl, notification };
    }
    try {
      const updated = await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: result.sentAt, status: "SENT" } });
      return { status: "sent" as const, fallbackUrl: undefined, notification: updated };
    } catch (error) {
      console.error(`WhatsApp enviado para o pedido ${order.publicId}, mas não foi possível registrar a confirmação`, error);
      return { status: "unknown" as const, fallbackUrl, notification };
    }
  } catch (error) {
    console.error("Falha ao enviar aviso do pedido pelo WhatsApp", error);
    const errorMessage = error instanceof Error ? error.message : "Falha desconhecida no envio";
    try {
      const updated = await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED", error: errorMessage } });
      return { status: "failed" as const, fallbackUrl, notification: updated };
    } catch (recordError) {
      console.error(`Não foi possível registrar a falha do WhatsApp no pedido ${order.publicId}`, recordError);
      return { status: "failed" as const, fallbackUrl, notification };
    }
  }
}

export async function notifyCustomerConfirmed(order: Pick<Order, "id" | "publicId" | "requesterPhone">) {
    const recipient = order.requesterPhone ? normalizePhoneNumber(order.requesterPhone) : "";
    if (!recipient) return { status: "not_configured" as const };
    const template = (await getSetting("confirmationMessage")) || "Olá! O motoboy já está ciente do seu pedido. A Procópio Express dará continuidade ao atendimento.";
    const message = template.replace(/\{pedido\}/gi, order.publicId);
    const notification = await prisma.notification.create({ data: { orderId: order.id, channel: "WHATSAPP", recipient, message } });
    try {
      const result = await sendBusinessMessage(recipient, message);
      const updated = await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: result.sentAt } });
      return { status: result.provider === "business" ? "sent" as const : "pending" as const, notification: updated };
    } catch (error) {
      console.error("Falha ao enviar confirmação básica ao cliente pelo WhatsApp", error);
      return { status: "failed" as const, notification };
  }
}
