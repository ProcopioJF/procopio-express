import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../middleware/errors.js";
import {
  ADMIN_ORDER_STATUS_TRANSITIONS,
  assertCompanyCanCreateOrder,
  buildOrderListQuery,
  COURIER_ORDER_STATUS_TRANSITIONS,
  summarizeOrderStatuses,
} from "./orders.js";

describe("company order permissions", () => {
  it("keeps status transitions explicit and does not allow cancellation by implication", () => {
    assert.equal(ADMIN_ORDER_STATUS_TRANSITIONS.FINALIZED, "CONFIRMED");
    assert.equal(ADMIN_ORDER_STATUS_TRANSITIONS.IN_TRANSIT, "DELIVERED");
    assert.equal(ADMIN_ORDER_STATUS_TRANSITIONS.CANCELLED, undefined);
    assert.equal(COURIER_ORDER_STATUS_TRANSITIONS.ASSIGNED, "PICKED_UP");
    assert.equal(COURIER_ORDER_STATUS_TRANSITIONS.CANCELLED, undefined);
  });

  it("keeps company order lists scoped to the authenticated company", () => {
    assert.deepEqual(
      buildOrderListQuery(
        { companyId: "company-b" },
        { companyId: "company-a", allowCompanyFilter: false },
      ).where,
      { companyId: "company-a" },
    );
    assert.deepEqual(
      buildOrderListQuery(
        { companyId: "company-b" },
        { allowCompanyFilter: true },
      ).where,
      { companyId: "company-b" },
    );
    assert.deepEqual(
      buildOrderListQuery({}, { allowCompanyFilter: true }).where,
      {},
    );
  });

  it("applies status, search, timezone boundaries, and pagination to exports", () => {
    const query = buildOrderListQuery(
      {
        status: "COMPLETED",
        from: "2026-10-01",
        to: "2026-10-31",
        search: "  PX-123 ",
        page: "2",
        pageSize: "10",
      },
      { companyId: "company-a", allowCompanyFilter: false },
    );

    assert.deepEqual(query.where, {
      companyId: "company-a",
      status: { in: ["FINALIZED", "DELIVERED"] },
      createdAt: {
        gte: new Date("2026-10-01T03:00:00.000Z"),
        lt: new Date("2026-11-01T03:00:00.000Z"),
      },
      OR: [
        { publicId: { contains: "PX-123", mode: "insensitive" } },
        { requesterName: { contains: "PX-123", mode: "insensitive" } },
        { recipientName: { contains: "PX-123", mode: "insensitive" } },
        { pickupNeighborhood: { contains: "PX-123", mode: "insensitive" } },
        { deliveryNeighborhood: { contains: "PX-123", mode: "insensitive" } },
      ],
    });
    assert.equal(query.skip, 10);
    assert.equal(query.take, 10);
  });

  it("allows company administrators and standard users to create orders", () => {
    assert.doesNotThrow(() => assertCompanyCanCreateOrder("ADMIN"));
    assert.doesNotThrow(() => assertCompanyCanCreateOrder("STANDARD"));
  });

  it("rejects order creation for restricted company users", () => {
    assert.throws(
      () => assertCompanyCanCreateOrder("RESTRICTED"),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 403 &&
        error.message === "Seu perfil não tem permissão para registrar pedidos.",
    );
  });

  it("returns status counts for every known order status", () => {
    const counts = summarizeOrderStatuses([
      { status: "PENDING", count: 3 },
      { status: "DELIVERED", count: 7 },
      { status: "CANCELLED", count: 2 },
    ]);

    assert.deepEqual(counts, {
      PENDING: 3,
      FINALIZED: 0,
      CONFIRMED: 0,
      ASSIGNED: 0,
      PICKED_UP: 0,
      IN_TRANSIT: 0,
      DELIVERED: 7,
      CANCELLED: 2,
    });
  });
});
