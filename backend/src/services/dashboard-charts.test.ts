import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildNeighborhoodRanking,
  monthlyRecordedValue,
} from "./dashboard-charts.js"

describe("monthly recorded values", () => {
  it("keeps missing prices distinct from a recorded zero", () => {
    assert.equal(monthlyRecordedValue(0, 0), null)
    assert.equal(monthlyRecordedValue(0, 1), 0)
    assert.equal(monthlyRecordedValue(125.5, 2), 125.5)
  })

  describe("neighborhood ranking", () => {
    it("sorts valid neighborhoods, limits to ten, and calculates participation", () => {
      const result = buildNeighborhoodRanking([
        { name: "Centro", orders: 2 },
        { name: " São Mateus ", orders: 3 },
        { name: "", orders: 20 },
        ...Array.from({ length: 10 }, (_, index) => ({
          name: `Bairro ${index}`,
          orders: 1,
        })),
      ])

      assert.equal(result.totalOrders, 15)
      assert.equal(result.neighborhoods.length, 10)
      assert.deepEqual(result.neighborhoods.slice(0, 2), [
        { name: "São Mateus", orders: 3, percentage: 20 },
        { name: "Centro", orders: 2, percentage: (2 / 15) * 100 },
      ])
    })

    it("returns an empty result when the period has no identified neighborhoods", () => {
      assert.deepEqual(buildNeighborhoodRanking([{ name: " ", orders: 2 }]), {
        neighborhoods: [],
        totalOrders: 0,
      })
    })
  })
})
