import assert from "node:assert/strict"

import { describe, it } from "node:test"

import {
  addressSchema,
  adminCompanyUpdateSchema,
  adminOrderStatusSchema,
  companyBranchPickupAddressSchema,
  companyPickupAddressQuerySchema,
  companyBranchSchema,
  companyMemberSchema,
  companyMemberUpdateSchema,
  createOrderSchema,
  createCompanySchema,
  changePasswordSchema,
  courierOrderStatusSchema,
  dashboardCompanyScopeSchema,
  financialEntryListQuerySchema,
  financialEntrySchema,
  leadSchema,
  orderListQuerySchema,
  orderCourierAssignmentSchema,
  planSchema,
  subscriptionSchema,
  systemUserPasswordResetSchema,
  systemUserSchema,
} from "./validation.js"
import { normalizeName } from "./services/normalization.js"

describe("admin dashboard company context", () => {
  it("accepts an optional company scope and rejects empty identifiers", () => {
    assert.deepEqual(dashboardCompanyScopeSchema.parse({}), {})
    assert.deepEqual(
      dashboardCompanyScopeSchema.parse({ companyId: "company-a" }),
      { companyId: "company-a" },
    )
    assert.equal(
      dashboardCompanyScopeSchema.safeParse({ companyId: "" }).success,
      false,
    )
  })
})

describe("company member permissions", () => {
  const member = {
    name: "Pessoa da empresa",
    email: "pessoa@empresa.com",
    password: "senha-segura-123",
  }

  it("allows creating standard and restricted users but not company administrators", () => {
    assert.equal(companyMemberSchema.parse(member).companyPermission, "STANDARD")
    assert.equal(
      companyMemberSchema.parse({
        ...member,
        companyPermission: "RESTRICTED",
      }).companyPermission,
      "RESTRICTED",
    )
    assert.equal(
      companyMemberSchema.safeParse({
        ...member,
        companyPermission: "ADMIN",
      }).success,
      false,
    )
  })

  it("prevents company users from granting administrator permission", () => {
    assert.equal(
      companyMemberUpdateSchema.safeParse({ companyPermission: "ADMIN" })
        .success,
      false,
    )
    assert.equal(
      companyMemberUpdateSchema.safeParse({ companyPermission: "STANDARD" })
        .success,
      true,
    )
  })
})

describe("admin company profile updates", () => {
  it("accepts limited company data updates and rejects empty updates", () => {
    assert.equal(
      adminCompanyUpdateSchema.safeParse({ name: "Shape Suplementos" })
        .success,
      true,
    )
    assert.equal(adminCompanyUpdateSchema.safeParse({}).success, false)
  })
})

describe("saved company pickup address validation", () => {
  const address = {
    rua: "Rua Halfeld",
    numero: "10",
    bairro: "Centro",
    cidade: "Juiz de Fora",
    estado: "MG",
    cep: "36010000",
  }

  it("accepts structured addresses and legacy free-text branch addresses", () => {
    assert.deepEqual(companyBranchPickupAddressSchema.parse(address), address)
    assert.equal(
      companyBranchSchema.safeParse({
        name: "Unidade Centro",
        address,
      }).success,
      true,
    )
    assert.equal(
      companyBranchSchema.safeParse({
        name: "Unidade antiga",
        address: "Rua antiga, 20 - Centro",
      }).success,
      true,
    )
  })

  it("requires complete address fields and allows saved-address selection on an order", () => {
    assert.equal(
      companyBranchPickupAddressSchema.safeParse({
        ...address,
        numero: "",
      }).success,
      false,
    )
    assert.equal(
      createOrderSchema.safeParse({
        pickupAddress: address,
        deliveryAddress: address,
        recipientName: "Destinatário",
        recipientPhone: "32999990000",
        requesterName: "Solicitante",
        requesterPhone: "32988887777",
        pickupLocationId: "branch-1",
      }).success,
      true,
    )
  })

  it("accepts each saved pickup source but rejects ambiguous selections", () => {
    const order = {
      pickupAddress: address,
      deliveryAddress: address,
      recipientName: "Destinatário",
      recipientPhone: "32999990000",
      requesterName: "Solicitante",
      requesterPhone: "32988887777",
    }

    assert.equal(
      createOrderSchema.safeParse({ ...order, pickupCustomerId: "customer-1" }).success,
      true,
    )
    assert.equal(
      createOrderSchema.safeParse({ ...order, pickupCompanyAddress: true }).success,
      true,
    )
    assert.equal(
      createOrderSchema.safeParse({
        ...order,
        pickupLocationId: "branch-1",
        pickupCustomerId: "customer-1",
      }).success,
      false,
    )
  })

  it("accepts each saved delivery source but rejects ambiguous selections", () => {
    const order = {
      pickupAddress: address,
      deliveryAddress: address,
      recipientName: "Destinatário",
      recipientPhone: "32999990000",
      requesterName: "Solicitante",
      requesterPhone: "32988887777",
    }

    assert.equal(
      createOrderSchema.safeParse({ ...order, deliveryLocationId: "branch-1" }).success,
      true,
    )
    assert.equal(
      createOrderSchema.safeParse({ ...order, deliveryCustomerId: "customer-1" }).success,
      true,
    )
    assert.equal(
      createOrderSchema.safeParse({ ...order, deliveryCompanyAddress: true }).success,
      true,
    )
    assert.equal(
      createOrderSchema.safeParse({
        ...order,
        deliveryLocationId: "branch-1",
        deliveryCustomerId: "customer-1",
      }).success,
      false,
    )
  })

  it("requires at least two characters for a pickup address search", () => {
    assert.deepEqual(companyPickupAddressQuerySchema.parse({ q: " SH " }), {
      q: "SH",
    })
    assert.equal(companyPickupAddressQuerySchema.safeParse({ q: "S" }).success, false)
    assert.equal(normalizeName("  SHÁPE   Suplementos "), "shape suplementos")
  })
})

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

  it("allows company passwords of any non-empty length while retaining staff limits", () => {
    for (const password of ["a", "senha", "x".repeat(101), "x".repeat(200)]) {
      assert.equal(
        systemUserSchema.safeParse({ ...user, password, role: "COMPANY" })
          .success,
        true,
      )
    }
    assert.equal(
      systemUserSchema.safeParse({ ...user, password: "", role: "COMPANY" })
        .success,
      false,
    )
    assert.equal(
      systemUserSchema.safeParse({ ...user, password: "curta", role: "ADMIN" })
        .success,
      false,
    )
    assert.equal(
      systemUserSchema.safeParse({
        ...user,
        password: "x".repeat(101),
        role: "COURIER",
      }).success,
      false,
    )
  })
})

describe("partner company account password validation", () => {
  const company = {
    name: "Empresa Parceira",
    phone: "32999999999",
    email: "parceiro@example.com",
    pickupAddress: {
      rua: "Rua Halfeld",
      numero: "10",
      bairro: "Centro",
      cidade: "Juiz de Fora",
      estado: "MG",
    },
  }

  it("accepts any non-empty password length", () => {
    for (const password of ["x", "senha", "p".repeat(200)]) {
      assert.equal(createCompanySchema.safeParse({ ...company, password }).success, true)
    }
    assert.equal(
      createCompanySchema.safeParse({ ...company, password: "" }).success,
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

describe("order courier assignment validation", () => {
  it("requires a courier id or null to remove an assignment", () => {
    assert.equal(
      orderCourierAssignmentSchema.safeParse({ courierId: "courier-1" }).success,
      true,
    )
    assert.equal(
      orderCourierAssignmentSchema.safeParse({ courierId: null }).success,
      true,
    )
    assert.equal(
      orderCourierAssignmentSchema.safeParse({ courierId: "" }).success,
      false,
    )
    assert.equal(
      orderCourierAssignmentSchema.safeParse({}).success,
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
        companyId: "company_123",
        from: "2025-03-01",
        to: "2025-03-31",
      }),
      {
        offset: 0,
        limit: 100,
        search: "mensalidade",
        type: "INCOME",
        companyId: "company_123",
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
