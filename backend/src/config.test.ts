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
    it("reports every missing setting without exposing configured values", () => {
      const readiness = getWhatsAppIntegrationReadiness({
        accessToken: "secret-token-value",
        phoneNumberId: "phone-id-value",
      })

      assert.equal(readiness.status, "SETUP_REQUIRED")
      assert.match(readiness.note, /WHATSAPP_OPERATIONS_NUMBER/)
      assert.match(readiness.note, /WHATSAPP_VERIFY_TOKEN/)
      assert.match(readiness.note, /WHATSAPP_APP_SECRET/)
      assert.doesNotMatch(readiness.note, /secret-token-value|phone-id-value/)
    })

    it("reports active only when outbound and webhook settings are present", () => {
      assert.deepEqual(
        getWhatsAppIntegrationReadiness({
          accessToken: "token",
          phoneNumberId: "phone-id",
          operationsNumber: "5511999999999",
          verifyToken: "verify-token",
          appSecret: "app-secret",
        }),
        {
          status: "ACTIVE",
          note: "Credenciais, número operacional e requisitos do webhook configurados.",
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
