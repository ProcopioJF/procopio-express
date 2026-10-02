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
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  whatsappAutoReply: process.env.WHATSAPP_AUTO_REPLY !== "false",
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

export const databaseConfigured = isDatabaseConfigured(config.databaseUrl);

if (config.nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET é obrigatório em produção");
}
if (config.nodeEnv === "production" && !databaseConfigured) {
  throw new Error("DATABASE_URL deve conter uma conexão PostgreSQL válida em produção");
}
if (config.nodeEnv === "production" && config.corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS deve conter os domínios autorizados em produção");
}
