import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getWhatsAppIntegrationReadiness,
  isDatabaseConfigured,
} from "./config.js";

describe("isDatabaseConfigured", () => {
  it("accepts valid local and hosted PostgreSQL URLs", () => {
    assert.equal(isDatabaseConfigured("postgresql://user:pass@localhost:5432/procopio"), true);
    assert.equal(isDatabaseConfigured("postgres://user:pass@db.example.com:5432/procopio"), true);
  });

  describe("getWhatsAppIntegrationReadiness", () => {
    it("keeps automatic sending unavailable even when future API settings are present", () => {
      assert.deepEqual(
        getWhatsAppIntegrationReadiness({
          enabled: false,
          accessToken: "token",
          phoneNumberId: "phone-id",
          operationsNumber: "5511999999999",
          templateName: "novo_pedido",
          templateLanguage: "pt_BR",
        }),
        {
          status: "NOT_AVAILABLE",
          note: "Envio automático desativado. Novos pedidos abrem uma mensagem pronta para envio manual no WhatsApp.",
        },
      )
    })

    it("reports every missing setting without exposing configured values", () => {
      const readiness = getWhatsAppIntegrationReadiness({
        enabled: true,
        accessToken: "secret-token-value",
        phoneNumberId: "phone-id-value",
      })

      assert.equal(readiness.status, "SETUP_REQUIRED")
      assert.match(readiness.note, /WHATSAPP_OPERATIONS_NUMBER/)
      assert.match(readiness.note, /WHATSAPP_TEMPLATE_NAME/)
      assert.match(readiness.note, /WHATSAPP_TEMPLATE_LANGUAGE/)
      assert.doesNotMatch(readiness.note, /secret-token-value|phone-id-value/)
    })

    it("reports active when the required outbound template settings are present", () => {
      assert.deepEqual(
        getWhatsAppIntegrationReadiness({
          enabled: true,
          accessToken: "token",
          phoneNumberId: "phone-id",
          operationsNumber: "5511999999999",
          templateName: "novo_pedido",
          templateLanguage: "pt_BR",
        }),
        {
          status: "ACTIVE",
          note: "Envio de templates WhatsApp configurado.",
        },
      )
    })
  })

  it("rejects missing, malformed, and example URLs", () => {
    assert.equal(isDatabaseConfigured(""), false);
    assert.equal(isDatabaseConfigured("not a URL"), false);
    assert.equal(isDatabaseConfigured("postgresql://user:SUA_SENHA@db.example.com:5432/procopio"), false);
    assert.equal(isDatabaseConfigured("postgresql://user:pass@db.SEU_PROJETO.supabase.co:5432/postgres"), false);
    assert.equal(isDatabaseConfigured("https://db.example.com"), false);
  });
});
