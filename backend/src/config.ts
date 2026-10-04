import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3333),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "desenvolvimento-altere-esta-chave",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean),
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappOperationsNumber: (process.env.WHATSAPP_OPERATIONS_NUMBER ?? "").replace(/\D/g, ""),
  whatsappAutoSend: process.env.WHATSAPP_AUTO_SEND === "true",
  whatsappTemplateName: process.env.WHATSAPP_TEMPLATE_NAME ?? "",
  whatsappTemplateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  whatsappBusinessApiReady:
    process.env.WHATSAPP_AUTO_SEND === "true" &&
    Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TEMPLATE_NAME &&
      process.env.WHATSAPP_TEMPLATE_LANGUAGE,
    ),
  routingApiUrl: (process.env.ROUTING_API_URL ?? "").trim().replace(/\/+$/, ""),
  perKmPricingEnabled: process.env.PER_KM_PRICING_ENABLED === "true",
};

export function isDatabaseConfigured(databaseUrl: string) {
  if (!databaseUrl || databaseUrl.includes("SUA_SENHA") || databaseUrl.includes("SEU_PROJETO")) return false;
  try {
    const parsed = new URL(databaseUrl);
    return ["postgres:", "postgresql:"].includes(parsed.protocol) && Boolean(parsed.hostname) && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

export function getWhatsAppIntegrationReadiness(settings: {
  enabled?: boolean
  accessToken?: string
  phoneNumberId?: string
  operationsNumber?: string
  templateName?: string
  templateLanguage?: string
}) {
  if (!settings.enabled) {
    return {
      status: "NOT_AVAILABLE" as const,
      note: "Envio automático desativado. Novos pedidos abrem uma mensagem pronta para envio manual no WhatsApp.",
    }
  }

  const requiredSettings = [
    ["accessToken", "WHATSAPP_ACCESS_TOKEN"],
    ["phoneNumberId", "WHATSAPP_PHONE_NUMBER_ID"],
    ["operationsNumber", "WHATSAPP_OPERATIONS_NUMBER"],
    ["templateName", "WHATSAPP_TEMPLATE_NAME"],
    ["templateLanguage", "WHATSAPP_TEMPLATE_LANGUAGE"],
  ] as const

  const missing = requiredSettings
    .filter(([key]) => !settings[key]?.trim())
    .map(([, variable]) => variable)

  return {
    status: missing.length === 0 ? "ACTIVE" as const : "SETUP_REQUIRED" as const,
    note: missing.length === 0
      ? "Envio de templates WhatsApp configurado."
      : `Configuração incompleta no backend. Variáveis pendentes: ${missing.join(", ")}.`,
  }
}

export const databaseConfigured = isDatabaseConfigured(config.databaseUrl);

if (config.nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET é obrigatório em produção");
}
if (config.nodeEnv === "production" && !databaseConfigured) {
  throw new Error("DATABASE_URL deve conter uma conexão PostgreSQL válida em produção");
}
if (config.nodeEnv === "production" && config.corsOrigins.length === 0 && !process.env.VERCEL_URL) {
  throw new Error("CORS_ORIGINS deve conter os domínios autorizados em produção");
}
