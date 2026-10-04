export type TestSeedEnvironment = Record<string, string | undefined>

const seedConfirmation = "I_UNDERSTAND_TEST_DATA_ONLY"

function supabaseProjectRef(databaseUrl: string, label: string) {
  let parsed: URL

  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error(`${label} não é uma URL de banco válida.`)
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${label} deve usar PostgreSQL.`)
  }

  const directHost = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)

  if (directHost) return directHost[1].toLowerCase()

  if (parsed.hostname.endsWith(".pooler.supabase.com")) {
    let username: string

    try {
      username = decodeURIComponent(parsed.username)
    } catch {
      throw new Error(
        `${label} contém um usuário pooler inválido; execução recusada.`,
      )
    }

    const poolerUser = username.match(/^postgres\.([a-z0-9]+)$/i)

    if (poolerUser) return poolerUser[1].toLowerCase()
  }

  throw new Error(
    `${label} não permite identificar o project ref Supabase; execução recusada.`,
  )
}

function databaseHost(databaseUrl: string, label: string) {
  try {
    return new URL(databaseUrl).hostname
  } catch {
    throw new Error(`${label} não é uma URL de banco válida.`)
  }
}

export function validateIntelligenceTestSeedEnvironment(
  testEnvironment: TestSeedEnvironment,

  primaryDatabaseUrls: string[],

  runtimeNodeEnv?: string,

  allowPrimaryTestDatabase = false,
) {
  const testUrl = testEnvironment.INTELLIGENCE_TEST_DATABASE_URL

  const expectedProjectRef =
    testEnvironment.INTELLIGENCE_TEST_PROJECT_REF?.toLowerCase()

  const testUserPassword = testEnvironment.INTELLIGENCE_TEST_USER_PASSWORD

  if (runtimeNodeEnv === "production" || testEnvironment.NODE_ENV !== "test") {
    throw new Error(
      "Seed recusado: configure NODE_ENV=test somente no .env.test.",
    )
  }

  if (testEnvironment.INTELLIGENCE_SEED_CONFIRM !== seedConfirmation) {
    throw new Error(
      "Seed recusado: a confirmação de ambiente de teste está ausente ou inválida.",
    )
  }

  if (!testUrl || !expectedProjectRef) {
    throw new Error(
      "Seed recusado: configure INTELLIGENCE_TEST_DATABASE_URL e INTELLIGENCE_TEST_PROJECT_REF em .env.test.",
    )
  }

  if (!testUserPassword || testUserPassword.length < 12) {
    throw new Error(
      "Seed recusado: configure INTELLIGENCE_TEST_USER_PASSWORD com pelo menos 12 caracteres em .env.test.",
    )
  }

  const actualTestProjectRef = supabaseProjectRef(
    testUrl,

    "INTELLIGENCE_TEST_DATABASE_URL",
  )

  if (actualTestProjectRef !== expectedProjectRef) {
    throw new Error(
      "Seed recusado: o project ref da URL não corresponde ao ref de teste declarado.",
    )
  }

  for (const primaryUrl of new Set(primaryDatabaseUrls.filter(Boolean))) {
    const primaryHost = databaseHost(primaryUrl, "DATABASE_URL principal")

    if (["localhost", "127.0.0.1", "::1"].includes(primaryHost)) continue

    const primaryProjectRef = supabaseProjectRef(
      primaryUrl,

      "DATABASE_URL principal",
    )

    if (
      primaryProjectRef === actualTestProjectRef &&
      !allowPrimaryTestDatabase
    ) {
      throw new Error(
        "Seed recusado: o project ref de teste coincide com uma conexão principal configurada localmente.",
      )
    }
  }

  return { databaseUrl: testUrl, userPassword: testUserPassword }
}
