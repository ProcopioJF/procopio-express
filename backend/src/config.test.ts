import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDatabaseConfigured } from "./config.js";

describe("isDatabaseConfigured", () => {
  it("accepts valid local and hosted PostgreSQL URLs", () => {
    assert.equal(isDatabaseConfigured("postgresql://user:pass@localhost:5432/procopio"), true);
    assert.equal(isDatabaseConfigured("postgres://user:pass@db.example.com:5432/procopio"), true);
  });

  it("rejects missing, malformed, and example URLs", () => {
    assert.equal(isDatabaseConfigured(""), false);
    assert.equal(isDatabaseConfigured("not a URL"), false);
    assert.equal(isDatabaseConfigured("postgresql://user:SUA_SENHA@db.example.com:5432/procopio"), false);
    assert.equal(isDatabaseConfigured("postgresql://user:pass@db.SEU_PROJETO.supabase.co:5432/postgres"), false);
    assert.equal(isDatabaseConfigured("https://db.example.com"), false);
  });
});
