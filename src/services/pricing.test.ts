import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePriceTableCsv } from "./pricing.js";

describe("parsePriceTableCsv", () => {
  it("reads fixed, range, per-kilometer, and quote tariffs", () => {
    assert.deepEqual(parsePriceTableCsv([
      "Bairro;Preço;Tipo",
      "Centro;R$ 12,00;FIXED",
      "Fontesville;R$ 25,00 a R$ 35,00;",
      "Humaitá;KM;",
      "Santa Luzia;R$ 2,50;PER_KM",
      "Torreões;Consultar valor;",
    ].join("\n")), [
      { destinationName: "Centro", pricingType: "FIXED", fixedPrice: 12 },
      { destinationName: "Fontesville", pricingType: "RANGE", minimumPrice: 25, maximumPrice: 35 },
      { destinationName: "Humaitá", pricingType: "PER_KM" },
      { destinationName: "Santa Luzia", pricingType: "PER_KM", perKmRate: 2.5 },
      { destinationName: "Torreões", pricingType: "QUOTE" },
    ]);
  });

  it("reads a dedicated per-kilometer column", () => {
    assert.deepEqual(parsePriceTableCsv("Bairro;Preço por KM;Tipo\nCentro;R$ 3,25;PER_KM"), [
      { destinationName: "Centro", pricingType: "PER_KM", perKmRate: 3.25 },
    ]);
  });

  it("infers per-kilometer pricing when its dedicated column is present", () => {
    assert.deepEqual(parsePriceTableCsv("Bairro;Valor por quilômetro\nCentro;R$ 3,25"), [
      { destinationName: "Centro", pricingType: "PER_KM", perKmRate: 3.25 },
    ]);
  });

  it("rejects ambiguous slash prices unless explicitly marked as a quote", () => {
    assert.throws(() => parsePriceTableCsv("Bairro;Preço\nGraminha;R$13/18"), /ambígua/);
    assert.deepEqual(parsePriceTableCsv("Bairro;Preço;Tipo\nGraminha;R$13/18;QUOTE"), [
      { destinationName: "Graminha", pricingType: "QUOTE" },
    ]);
  });
});
