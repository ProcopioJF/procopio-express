import assert from "node:assert/strict"
import { describe, it } from "node:test"
import bcrypt from "bcryptjs"
import { hashPassword, verifyPassword } from "./auth.js"

describe("password hashing", () => {
  it("supports short and long passwords without bcrypt's 72-byte truncation", async () => {
    for (const password of ["x", "senha-curta", "p".repeat(300)]) {
      const hash = await hashPassword(password)
      assert.equal(await verifyPassword(password, hash), true)
      assert.equal(await verifyPassword(`${password}errado`, hash), false)
    }
  })

  it("continues to verify existing bcrypt hashes", async () => {
    const hash = await bcrypt.hash("senha-legada", 4)
    assert.equal(await verifyPassword("senha-legada", hash), true)
    assert.equal(await verifyPassword("senha-incorreta", hash), false)
  })
})
