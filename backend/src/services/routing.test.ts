import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "../config.js";
import { getRoadDistanceKm } from "./routing.js";

describe("getRoadDistanceKm", () => {
  it("keeps per-kilometer pricing disabled by default", async () => {
    const originalRoutingUrl = config.routingApiUrl;
    const originalPerKmEnabled = config.perKmPricingEnabled;
    const originalFetch = globalThis.fetch;
    config.routingApiUrl = "https://routes.example/route/v1/driving";
    config.perKmPricingEnabled = false;
    globalThis.fetch = async () => {
      throw new Error("Routing provider must not be called when pricing is disabled");
    };
    try {
      assert.equal(await getRoadDistanceKm(
        { latitude: -21.76, longitude: -43.35 },
        { latitude: -21.75, longitude: -43.34 },
      ), null);
    } finally {
      globalThis.fetch = originalFetch;
      config.routingApiUrl = originalRoutingUrl;
      config.perKmPricingEnabled = originalPerKmEnabled;
    }
  });

  it("returns no distance when the provider is not configured", async () => {
    const originalRoutingUrl = config.routingApiUrl;
    const originalPerKmEnabled = config.perKmPricingEnabled;
    config.routingApiUrl = "";
    config.perKmPricingEnabled = true;
    try {
      assert.equal(await getRoadDistanceKm(
        { latitude: -21.76, longitude: -43.35 },
        { latitude: -21.75, longitude: -43.34 },
      ), null);
    } finally {
      config.routingApiUrl = originalRoutingUrl;
      config.perKmPricingEnabled = originalPerKmEnabled;
    }
  });

  it("returns no distance for an invalid provider URL", async () => {
    const originalRoutingUrl = config.routingApiUrl;
    const originalPerKmEnabled = config.perKmPricingEnabled;
    config.routingApiUrl = "not-a-url";
    config.perKmPricingEnabled = true;
    try {
      assert.equal(await getRoadDistanceKm(
        { latitude: -21.76, longitude: -43.35 },
        { latitude: -21.75, longitude: -43.34 },
      ), null);
    } finally {
      config.routingApiUrl = originalRoutingUrl;
      config.perKmPricingEnabled = originalPerKmEnabled;
    }
  });

  it("requests OSRM route distance and converts meters to kilometers", async () => {
    const originalFetch = globalThis.fetch;
    const originalRoutingUrl = config.routingApiUrl;
    const originalPerKmEnabled = config.perKmPricingEnabled;
    config.routingApiUrl = "https://routes.example/route/v1/driving?access_token=test-token";
    config.perKmPricingEnabled = true;
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.pathname, "/route/v1/driving/-43.35,-21.76;-43.34,-21.75");
      assert.equal(url.searchParams.get("access_token"), "test-token");
      assert.equal(url.searchParams.get("overview"), "false");
      return new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12500 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      assert.equal(await getRoadDistanceKm(
        { latitude: -21.76, longitude: -43.35 },
        { latitude: -21.75, longitude: -43.34 },
      ), 12.5);
    } finally {
      globalThis.fetch = originalFetch;
      config.routingApiUrl = originalRoutingUrl;
      config.perKmPricingEnabled = originalPerKmEnabled;
    }
  });

  it("returns no distance when the provider cannot find a route", async () => {
    const originalFetch = globalThis.fetch;
    const originalRoutingUrl = config.routingApiUrl;
    const originalPerKmEnabled = config.perKmPricingEnabled;
    config.routingApiUrl = "https://routes.example/route/v1/driving";
    config.perKmPricingEnabled = true;
    globalThis.fetch = async () => new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 });
    try {
      assert.equal(await getRoadDistanceKm(
        { latitude: -21.76, longitude: -43.35 },
        { latitude: -21.75, longitude: -43.34 },
      ), null);
    } finally {
      globalThis.fetch = originalFetch;
      config.routingApiUrl = originalRoutingUrl;
      config.perKmPricingEnabled = originalPerKmEnabled;
    }
  });
});
