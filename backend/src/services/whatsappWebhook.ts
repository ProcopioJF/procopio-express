import crypto from "node:crypto";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { config } from "../config.js";

type IncomingMessage = { id?: string; from?: string; text?: { body?: string } };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function linkRequesterToFinalizedOrder(message: IncomingMessage) {
  const sender = message.from?.replace(/\D/g, "");
  const text = message.text?.body ?? "";
  if (!sender || !text) return null;
  const candidates = await prisma.order.findMany({
    where: { status: OrderStatus.FINALIZED, requesterPhone: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const normalizedText = normalized(text);
  const matches = candidates.filter(order => {
    const pickup = order.pickupAddress as { rua?: string; numero?: string; bairro?: string };
    const delivery = order.deliveryAddress as { rua?: string; numero?: string; bairro?: string };
    const required = [order.recipientName, order.recipientPhone ?? "", pickup.rua ?? "", pickup.numero ?? "", pickup.bairro ?? "", delivery.rua ?? "", delivery.numero ?? "", delivery.bairro ?? "", order.notes ?? ""].filter(Boolean).map(normalized);
    return required.every(value => value && normalizedText.includes(value));
  });
  if (matches.length !== 1) return null;
  return prisma.order.update({ where: { id: matches[0].id }, data: { requesterPhone: sender } });
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  if (!config.whatsappAppSecret) return config.nodeEnv !== "production";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", config.whatsappAppSecret).update(rawBody).digest("hex");
  const received = signature.slice("sha256=".length);
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function processIncomingWebhook(body: { entry?: Array<{ changes?: Array<{ value?: { messages?: IncomingMessage[] } }> }> }) {
  const messages = body.entry?.flatMap(entry => entry.changes?.flatMap(change => change.value?.messages ?? []) ?? []) ?? [];
  return Promise.all(messages.map(async message => {
    if (!message.from || !message.text?.body) return { status: "ignored" };
    const linked = await linkRequesterToFinalizedOrder(message);
    return { status: linked ? "requester_linked" : "received_without_match", order: linked?.publicId };
  }));
}
