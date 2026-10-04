import type { Order } from "@prisma/client";
import { prisma } from "../db.js";
import { config } from "../config.js";
import {
  buildNewOrderWhatsAppMessage,
  buildNewOrderWhatsAppTemplateParameters,
  type NewOrderWhatsAppData,
} from "./whatsappMessage.js";

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

async function sendBusinessMessage(recipient: string, message: string) {
  if (!config.whatsappAutoSend || !config.whatsappToken || !config.whatsappPhoneNumberId) {
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

async function sendNewOrderTemplate(
  recipient: string,
  order: NewOrderWhatsAppData,
) {
  if (
    !config.whatsappAutoSend ||
    !config.whatsappToken ||
    !config.whatsappPhoneNumberId ||
    !config.whatsappTemplateName ||
    !config.whatsappTemplateLanguage
  ) {
    return { sentAt: null, provider: "fallback" as const };
  }

  const parameters = buildNewOrderWhatsAppTemplateParameters(order);
  const response = await fetch(`https://graph.facebook.com/v22.0/${config.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: config.whatsappTemplateName,
        language: { code: config.whatsappTemplateLanguage },
        components: [{
          type: "body",
          parameters: parameters.map(text => ({ type: "text", text })),
        }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp Business API respondeu ${response.status}`);
  return { sentAt: new Date(), provider: "business" as const };
}

async function getSetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return typeof setting?.value === "string" ? setting.value : undefined;
}

export async function notifyNewOrder(
  order: Order & { company: { name: string } | null },
) {
  const configuredRecipient = (await getSetting("whatsappOperationsNumber")) || config.whatsappOperationsNumber;
  const recipient = configuredRecipient ? normalizePhoneNumber(configuredRecipient) : "";
  if (!recipient) return { status: "not_configured" as const, fallbackUrl: undefined };
  const message = buildNewOrderWhatsAppMessage(order);
  const fallbackUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  let notification;
  try {
    notification = await prisma.notification.create({ data: { orderId: order.id, channel: "WHATSAPP", recipient, message } });
  } catch (error) {
    console.error("Pedido salvo, mas não foi possível registrar a notificação do WhatsApp", error);
    return { status: "failed" as const, fallbackUrl };
  }
  try {
    const result = await sendNewOrderTemplate(recipient, order);
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
    if (!config.whatsappAutoSend) return { status: "pending" as const };
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
