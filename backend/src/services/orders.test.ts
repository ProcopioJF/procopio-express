import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../middleware/errors.js";
import { assertCompanyCanCreateOrder, summarizeOrderStatuses } from "./orders.js";

describe("company order permissions", () => {
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
