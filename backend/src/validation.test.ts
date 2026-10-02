import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financialEntrySchema, leadSchema, planSchema, subscriptionSchema } from "./validation.js";

describe("decimal(10,2) validation limits", () => {
  it("accepts the maximum representable value", () => {
    assert.equal(financialEntrySchema.safeParse({
      type: "INCOME",
      description: "Receita",
      category: "Vendas",
      amount: 99_999_999.99,
      occurredAt: new Date(),
    }).success, true);
  });

  it("rejects values that exceed the database precision", () => {
    assert.equal(financialEntrySchema.safeParse({
      type: "INCOME",
      description: "Receita",
      category: "Vendas",
      amount: 100_000_000,
      occurredAt: new Date(),
    }).success, false);
    assert.equal(planSchema.safeParse({
      name: "Plano",
      monthlyPrice: 100_000_000,
      annualPrice: 0,
    }).success, false);
    assert.equal(leadSchema.safeParse({
      companyName: "Empresa",
      contactName: "Contato",
      estimatedMonthlyRevenue: 100_000_000,
    }).success, false);
    assert.equal(subscriptionSchema.safeParse({
      companyId: "company",
      planId: "plan",
      monthlyPrice: 100_000_000,
    }).success, false);
  });
});
