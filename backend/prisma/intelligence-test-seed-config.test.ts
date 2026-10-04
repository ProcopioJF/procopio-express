import assert from "node:assert/strict"

import { describe, it } from "node:test"

import { validateIntelligenceTestSeedEnvironment } from "./intelligence-test-seed-config.js"

const confirmation = "I_UNDERSTAND_TEST_DATA_ONLY"

const testUrl =
  "postgresql://postgres:test-password@db.testproject123.supabase.co:5432/postgres"

function validEnvironment() {
  return {
    NODE_ENV: "test",

    INTELLIGENCE_TEST_DATABASE_URL: testUrl,

    INTELLIGENCE_TEST_PROJECT_REF: "testproject123",

    INTELLIGENCE_SEED_CONFIRM: confirmation,

    INTELLIGENCE_TEST_USER_PASSWORD: "local-test-password-123",
  }
}

describe("validateIntelligenceTestSeedEnvironment", () => {
  it("accepts a separate Supabase project and a local primary database", () => {
    const config = validateIntelligenceTestSeedEnvironment(
      validEnvironment(),

      ["postgresql://localhost:5432/procopio"],
    )

    assert.equal(config.databaseUrl, testUrl)

    assert.equal(config.userPassword, "local-test-password-123")
  })

  it("rejects production runtime and missing test mode", () => {
    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          validEnvironment(),

          [],

          "production",
        ),

      /NODE_ENV=test/,
    )

    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          { ...validEnvironment(), NODE_ENV: "development" },

          [],
        ),

      /NODE_ENV=test/,
    )
  })

  it("requires explicit seed confirmation and a private password", () => {
    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          { ...validEnvironment(), INTELLIGENCE_SEED_CONFIRM: "" },

          [],
        ),

      /confirmação de ambiente/,
    )

    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          { ...validEnvironment(), INTELLIGENCE_TEST_USER_PASSWORD: "short" },

          [],
        ),

      /pelo menos 12 caracteres/,
    )
  })

  it("rejects mismatched project refs and non-Supabase destinations", () => {
    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          {
            ...validEnvironment(),

            INTELLIGENCE_TEST_PROJECT_REF: "anotherproject",
          },

          [],
        ),

      /não corresponde ao ref de teste/,
    )

    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          {
            ...validEnvironment(),

            INTELLIGENCE_TEST_DATABASE_URL:
              "postgresql://localhost:5432/procopio",
          },

          [],
        ),

      /não permite identificar o project ref Supabase/,
    )
  })

  it("rejects a primary Supabase URL for the exact same project", () => {
    const pooledPrimaryUrl =
      "postgresql://postgres.testproject123:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          validEnvironment(),

          [pooledPrimaryUrl],
        ),

      /coincide com uma conexão principal/,
    )
  })

  it("allows the matching test project only with an explicit opt-in", () => {
    const pooledPrimaryUrl =
      "postgresql://postgres.testproject123:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

    const config = validateIntelligenceTestSeedEnvironment(
      validEnvironment(),
      [pooledPrimaryUrl],
      undefined,
      true,
    )

    assert.equal(config.databaseUrl, testUrl)
  })

  it("accepts a pooler URL and rejects malformed encoded usernames", () => {
    const poolerEnvironment = {
      ...validEnvironment(),
      INTELLIGENCE_TEST_DATABASE_URL:
        "postgresql://postgres.testproject123:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    }

    assert.equal(
      validateIntelligenceTestSeedEnvironment(poolerEnvironment, [])
        .databaseUrl,
      poolerEnvironment.INTELLIGENCE_TEST_DATABASE_URL,
    )

    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(
          {
            ...poolerEnvironment,
            INTELLIGENCE_TEST_DATABASE_URL:
              "postgresql://postgres.%E0%A4%A:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
          },
          [],
        ),
      /usuário pooler inválido/,
    )
  })

  it("refuses unrecognized remote primary databases instead of guessing", () => {
    assert.throws(
      () =>
        validateIntelligenceTestSeedEnvironment(validEnvironment(), [
          "postgresql://app:password@db.example.com:5432/procopio",
        ]),

      /não permite identificar o project ref Supabase/,
    )
  })
})
