import assert from "node:assert/strict"

import { describe, it } from "node:test"

import {
  addressSchema,
  adminOrderStatusSchema,
  changePasswordSchema,
  courierOrderStatusSchema,
  financialEntryListQuerySchema,
  financialEntrySchema,
  leadSchema,
  orderListQuerySchema,
  planSchema,
  subscriptionSchema,
  systemUserPasswordResetSchema,
  systemUserSchema,
} from "./validation.js"

describe("system user profile validation", () => {
  const user = {
    name: "João Entregador",
    email: "joao@example.com",
    password: "senha-segura-com-12",
  }

  it("defaults newly created system users to administrators for compatibility", () => {
    assert.equal(systemUserSchema.parse(user).role, "ADMIN")
  })

  it("accepts courier and company profiles and rejects unsupported profiles", () => {
    assert.equal(
      systemUserSchema.parse({ ...user, role: "COURIER" }).role,
      "COURIER",
    )
    assert.equal(
      systemUserSchema.parse({ ...user, role: "COMPANY" }).role,
      "COMPANY",
    )
    assert.equal(
      systemUserSchema.safeParse({ ...user, role: "UNSUPPORTED" }).success,
      false,
    )
  })
})

describe("system user temporary password validation", () => {
  it("requires a temporary password of at least 12 characters", () => {
    assert.equal(
      systemUserPasswordResetSchema.safeParse({
        password: "senha-temporaria-segura",
      }).success,
      true,
    )
    assert.equal(
      systemUserPasswordResetSchema.safeParse({ password: "curta" }).success,
      false,
    )
    assert.equal(
      systemUserPasswordResetSchema.safeParse({ password: "x".repeat(101) })
        .success,
      false,
    )
  })
})

describe("company password change validation", () => {
  it("requires the current password and a new password of at least 12 characters", () => {
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: "senha atual",
        newPassword: "senha-com-12",
      }).success,
      true,
    )
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: "senha atual",
        newPassword: "curta",
      }).success,
      false,
    )
    assert.equal(
      changePasswordSchema.safeParse({
        newPassword: "senha-com-12",
      }).success,
      false,
    )
  })
})

describe("delivery address CEP validation", () => {
  const address = {
    rua: "Rua Halfeld",
    numero: "10",
    bairro: "Centro",
    cidade: "Juiz de Fora",
    estado: "MG",
  }

  it("accepts an omitted or empty CEP", () => {
    assert.equal(addressSchema.safeParse(address).success, true)
    assert.equal(addressSchema.safeParse({ ...address, cep: "" }).success, true)
  })

  it("accepts a complete CEP and rejects partial values", () => {
    assert.equal(addressSchema.safeParse({ ...address, cep: "36010000" }).success, true)
    assert.equal(addressSchema.safeParse({ ...address, cep: "36010" }).success, false)
  })
})

describe("courier order status validation", () => {
  it("accepts only delivery progress statuses", () => {
    assert.deepEqual(courierOrderStatusSchema.parse({ status: "PICKED_UP" }), {
      status: "PICKED_UP",
    })
    assert.equal(
      courierOrderStatusSchema.safeParse({ status: "CANCELLED" }).success,
      false,
    )
    assert.equal(
      courierOrderStatusSchema.safeParse({ status: "ASSIGNED" }).success,
      false,
    )
  })
})

describe("admin order status validation", () => {
  it("accepts delivery progress statuses but not assignment or cancellation", () => {
    assert.deepEqual(adminOrderStatusSchema.parse({ status: "CONFIRMED" }), {
      status: "CONFIRMED",
    })
    assert.deepEqual(adminOrderStatusSchema.parse({ status: "DELIVERED" }), {
      status: "DELIVERED",
    })
    assert.equal(
      adminOrderStatusSchema.safeParse({ status: "ASSIGNED" }).success,
      false,
    )
    assert.equal(
      adminOrderStatusSchema.safeParse({ status: "CANCELLED" }).success,
      false,
    )
  })
})

describe("financial entry list pagination", () => {
  it("uses a safe default page and allows bounded offsets", () => {
    assert.deepEqual(financialEntryListQuerySchema.parse({}), {
      offset: 0,
      limit: 100,
      search: "",
    })
    assert.deepEqual(
      financialEntryListQuerySchema.parse({ offset: "250", limit: "50" }),
      { offset: 250, limit: 50, search: "" },
    )
  })

  it("validates type, date range, offsets, and page size", () => {
    assert.equal(
      financialEntryListQuerySchema.safeParse({ offset: -1 }).success,
      false,
    )
    assert.equal(
      financialEntryListQuerySchema.safeParse({ limit: 101 }).success,
      false,
    )
    assert.equal(
      financialEntryListQuerySchema.safeParse({ type: "REFUND" }).success,
      false,
    )
    assert.equal(
      financialEntryListQuerySchema.safeParse({ from: "2025-02-30" }).success,
      false,
    )
    assert.equal(
      financialEntryListQuerySchema.safeParse({
        from: "2025-03-02",
        to: "2025-03-01",
      }).success,
      false,
    )
    assert.deepEqual(
      financialEntryListQuerySchema.parse({
        search: "  mensalidade ",
        type: "INCOME",
        from: "2025-03-01",
        to: "2025-03-31",
      }),
      {
        offset: 0,
        limit: 100,
        search: "mensalidade",
        type: "INCOME",
        from: "2025-03-01",
        to: "2025-03-31",
      },
    )
  })
})

describe("decimal(10,2) validation limits", () => {
  it("accepts the maximum representable value", () => {
    assert.equal(
      financialEntrySchema.safeParse({
        type: "INCOME",

        description: "Receita",

        category: "Vendas",

        amount: 99_999_999.99,

        occurredAt: new Date(),
      }).success,
      true,
    )
  })

  describe("order list query validation", () => {
    it("applies safe pagination defaults and accepts completed status", () => {
      assert.deepEqual(orderListQuerySchema.parse({ status: "COMPLETED" }), {
        page: 1,

        pageSize: 25,

        search: "",

        status: "COMPLETED",
      })
    })

    it("rejects impossible dates, reversed ranges, and oversized pages", () => {
      assert.equal(
        orderListQuerySchema.safeParse({ from: "2025-02-30" }).success,
        false,
      )

      assert.equal(
        orderListQuerySchema.safeParse({ from: "2025-03-02", to: "2025-03-01" })
          .success,
        false,
      )

      assert.equal(
        orderListQuerySchema.safeParse({ pageSize: 101 }).success,
        false,
      )
    })
  })

  it("rejects values that exceed the database precision", () => {
    assert.equal(
      financialEntrySchema.safeParse({
        type: "INCOME",

        description: "Receita",

        category: "Vendas",

        amount: 100_000_000,

        occurredAt: new Date(),
      }).success,
      false,
    )

    assert.equal(
      planSchema.safeParse({
        name: "Plano",

        monthlyPrice: 100_000_000,

        annualPrice: 0,
      }).success,
      false,
    )

    assert.equal(
      leadSchema.safeParse({
        companyName: "Empresa",

        contactName: "Contato",

        estimatedMonthlyRevenue: 100_000_000,
      }).success,
      false,
    )

    assert.equal(
      subscriptionSchema.safeParse({
        companyId: "company",

        planId: "plan",

        monthlyPrice: 100_000_000,
      }).success,
      false,
    )
  })
})
