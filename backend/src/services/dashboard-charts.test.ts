import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { monthlyRecordedValue } from "./dashboard-charts.js"

describe("monthly recorded values", () => {
  it("keeps missing prices distinct from a recorded zero", () => {
    assert.equal(monthlyRecordedValue(0, 0), null)
    assert.equal(monthlyRecordedValue(0, 1), 0)
    assert.equal(monthlyRecordedValue(125.5, 2), 125.5)
  })
})
