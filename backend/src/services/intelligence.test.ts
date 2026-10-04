import assert from "node:assert/strict"

import { describe, it } from "node:test"

import {
  answerIntelligenceQuestion,
  resolveIntelligenceScope,
  type IntelligenceMetrics,
} from "./intelligence.js"
import { intelligenceQuestionSchema } from "../validation.js"

const metrics: IntelligenceMetrics = {
  scope: "company",

  ordersAnalyzed: 14,

  cancelledOrders: 2,

  ordersWithRecordedPrice: 9,

  ordersWithoutRecordedPrice: 5,

  totalRecordedValue: 324.5,

  averageRecordedPrice: 36.055555,

  ordersWithDistance: 3,

  ordersWithoutDistance: 11,

  totalDistanceKm: 18.4,

  averageDistanceKm: 6.133333,

  topPickupNeighborhood: { name: "Centro", count: 8 },

  topDeliveryNeighborhood: { name: "São Mateus", count: 6 },

  highestAveragePriceNeighborhood: {
    name: "Cascatinha",
    pricedOrders: 3,
    averagePrice: 52.4,
  },

  topRequesterThisMonth: { name: "Ana", count: 3 },

  topCompanyThisMonth: null,

  topCompanyAllTime: null,

  peakOrderCreationHour: { hour: 14, count: 5 },

  monthlyOrders: [
    { month: "2026-08", orders: 4, recordedValue: 82 },

    { month: "2026-09", orders: 7, recordedValue: 160.5 },
  ],
}

describe("answerIntelligenceQuestion", () => {
  it("limits companies to their authenticated company scope", () => {
    assert.deepEqual(
      resolveIntelligenceScope({ role: "COMPANY", companyId: "company-1" }),
      { allowed: true, companyId: "company-1" },
    )
    assert.deepEqual(resolveIntelligenceScope({ role: "ADMIN" }), {
      allowed: true,
      companyId: undefined,
    })
    assert.deepEqual(resolveIntelligenceScope({ role: "COMPANY" }), {
      allowed: false,
    })
    assert.deepEqual(resolveIntelligenceScope({ role: "COURIER" }), {
      allowed: false,
    })
  })

  it("validates and bounds user questions", () => {
    assert.equal(
      intelligenceQuestionSchema.safeParse({ question: "  Quantos pedidos? " })
        .success,
      true,
    )
    assert.equal(
      intelligenceQuestionSchema.safeParse({ question: "   " }).success,
      false,
    )
    assert.equal(
      intelligenceQuestionSchema.safeParse({ question: "x".repeat(501) })
        .success,
      false,
    )
  })

  it("reports prices only for orders with recorded values", () => {
    const answer = answerIntelligenceQuestion("Qual o valor total?", metrics)

    assert.match(answer, /9 têm preço registrado/)

    assert.match(answer, /R\$ 324,50/)

    assert.match(answer, /5 pedidos não têm preço fechado/)
  })

  it("does not invent distances when no orders have measured kilometers", () => {
    const answer = answerIntelligenceQuestion("Quantos km rodamos?", {
      ...metrics,

      ordersWithDistance: 0,

      totalDistanceKm: 0,

      averageDistanceKm: 0,
    })

    assert.match(answer, /nenhum tem distância registrada/)

    assert.match(answer, /Não vou estimar quilômetros ausentes/)
  })

  it("reports measured kilometers and excludes orders without distance", () => {
    const answer = answerIntelligenceQuestion("Quantos quilômetros?", metrics);

    assert.match(answer, /18,4 km somados em 3 pedidos/)

    assert.match(answer, /11 pedidos não têm distância registrada/)
  })

  it("separates neighborhood volume from cost conclusions", () => {
    const answer = answerIntelligenceQuestion(
      "Quais bairros concentram pedidos?",
      metrics,
    )

    assert.match(answer, /Centro \(8 pedidos\)/)

    assert.match(answer, /São Mateus \(6 pedidos\)/)

    assert.match(answer, /não comprova menor custo/)
  })

  it("qualifies neighborhood price comparisons by recorded values", () => {
    const answer = answerIntelligenceQuestion(
      "Onde posso reduzir custos?",
      metrics,
    )

    assert.match(answer, /Cascatinha/)

    assert.match(answer, /3 pedidos com preço informado/)

    assert.match(answer, /não prova que o custo operacional seja maior/)
  })

  it("uses registered neighborhood prices for spending-reduction questions", () => {
    const answer = answerIntelligenceQuestion(
      "Qual bairro posso analisar para reduzir gastos?",
      metrics,
    );
    assert.match(answer, /Cascatinha/);
  });

  it("states that peak time means order registration time", () => {
    const answer = answerIntelligenceQuestion("Qual o melhor horário?", metrics)

    assert.match(answer, /14h, no horário de Brasília, com 5 pedidos/)

    assert.match(answer, /não horário de coleta ou entrega/)
  })

  it("does not forecast without a forecasting model and sufficient history", () => {
    const answer = answerIntelligenceQuestion(
      "Como será o próximo mês?",
      metrics,
    )

    assert.match(answer, /Não vou estimar o próximo mês/)

    assert.match(answer, /ago de 2026: 4/)
  })

  it("reports requester rankings only within the company's own scope", () => {
    const answer = answerIntelligenceQuestion(
      "Quem mais solicitou entregas este mês?",

      metrics,
    )

    assert.match(answer, /Ana aparece como principal solicitante entre os pedidos deste mês/);

    const adminAnswer = answerIntelligenceQuestion(
      "Qual empresa mais pediu este mês?",

      {
        ...metrics,

        scope: "operation",
        topRequesterThisMonth: null,
        topCompanyThisMonth: { name: "Empresa A", count: 7 },
        topCompanyAllTime: { name: "Empresa B", count: 90 },
      },
    );
    assert.match(adminAnswer, /Empresa A registrou mais pedidos neste mês: 7/);
    assert.doesNotMatch(adminAnswer, /Ana/);

    const historicCompanyAnswer = answerIntelligenceQuestion(
      "Qual empresa tem mais entregas?",
      {
        ...metrics,
        scope: "operation",
        topRequesterThisMonth: null,
        topCompanyThisMonth: { name: "Empresa A", count: 7 },
        topCompanyAllTime: { name: "Empresa B", count: 90 },
      },
    );
    assert.match(historicCompanyAnswer, /Empresa B registrou mais pedidos no histórico: 90/);
  });
});
