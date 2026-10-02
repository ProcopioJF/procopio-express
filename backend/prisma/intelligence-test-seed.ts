import { randomUUID } from "node:crypto"

import { readFileSync } from "node:fs"

import { resolve } from "node:path"

import { Prisma, PrismaClient } from "@prisma/client"

import dotenv from "dotenv"

const seedConfirmation = "I_UNDERSTAND_TEST_DATA_ONLY"

const testEnvPath = resolve(process.cwd(), "backend/.env.test")

function readEnvironmentFile(path: string) {
  try {
    return dotenv.parse(readFileSync(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}

    throw error
  }
}

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
    const poolerUser = decodeURIComponent(parsed.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    )

    if (poolerUser) return poolerUser[1].toLowerCase()
  }

  throw new Error(
    `${label} não permite identificar o project ref Supabase; execução recusada.`,
  )
}

function loadTestDatabaseUrl() {
  const testEnvironment = readEnvironmentFile(testEnvPath)

  const testUrl = testEnvironment.INTELLIGENCE_TEST_DATABASE_URL

  const expectedProjectRef =
    testEnvironment.INTELLIGENCE_TEST_PROJECT_REF?.toLowerCase()

  if (
    process.env.NODE_ENV === "production" ||
    testEnvironment.NODE_ENV !== "test"
  ) {
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

  const actualTestProjectRef = supabaseProjectRef(
    testUrl,
    "INTELLIGENCE_TEST_DATABASE_URL",
  )

  if (actualTestProjectRef !== expectedProjectRef) {
    throw new Error(
      "Seed recusado: o project ref da URL não corresponde ao ref de teste declarado.",
    )
  }

  const primaryEnvironmentFiles = [
    readEnvironmentFile(resolve(process.cwd(), ".env")),

    readEnvironmentFile(resolve(process.cwd(), "backend/.env")),
  ]

  const primaryUrls = new Set(
    [
      process.env.DATABASE_URL,

      ...primaryEnvironmentFiles.map((environment) => environment.DATABASE_URL),
    ].filter((value): value is string => Boolean(value)),
  )

  for (const primaryUrl of primaryUrls) {
    let primaryHost: string

    try {
      primaryHost = new URL(primaryUrl).hostname
    } catch {
      throw new Error(
        "Seed recusado: DATABASE_URL principal não é uma URL válida.",
      )
    }

    if (["localhost", "127.0.0.1", "::1"].includes(primaryHost)) continue

    const primaryProjectRef = supabaseProjectRef(
      primaryUrl,
      "DATABASE_URL principal",
    )

    if (primaryProjectRef === actualTestProjectRef) {
      throw new Error(
        "Seed recusado: o project ref de teste coincide com uma conexão principal configurada localmente.",
      )
    }
  }

  return testUrl
}

const profiles = [
  {
    document: "TEST-PROCOPIO-INTEL-001",
    name: "Mercado Horizonte Teste",
    neighborhood: "Centro",
    frequency: 1,
  },

  {
    document: "TEST-PROCOPIO-INTEL-002",
    name: "Farmácia Vila Exemplo",
    neighborhood: "São Mateus",
    frequency: 2,
  },

  {
    document: "TEST-PROCOPIO-INTEL-003",
    name: "Ateliê Rota Fictícia",
    neighborhood: "Cascatinha",
    frequency: 3,
  },
] as const

const monthlyOrdersPerCompany = 24
interface SeedCount {
  company: string
  orders: number
}
const monthStarts = (() => {
  const now = new Date()

  return Array.from(
    { length: 6 },
    (_, index) =>
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6 + index, 1),
      ),
  )
})()

function monthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1))
}

function buildOrders(
  companyId: string,
  profileIndex: number,
): Prisma.OrderCreateManyInput[] {
  return monthStarts.flatMap((monthDate, monthIndex) => {
    const month = monthStart(
      monthDate.getUTCFullYear(),
      monthDate.getUTCMonth(),
    )

    const nextMonth = monthStart(
      monthDate.getUTCFullYear(),
      monthDate.getUTCMonth() + 1,
    )

    const daysInMonth = Math.round(
      (nextMonth.getTime() - month.getTime()) / (24 * 60 * 60 * 1000),
    )

    return Array.from({ length: monthlyOrdersPerCompany }, (_, orderIndex) => {
      const day = 1 + ((orderIndex * 7 + profileIndex * 3) % daysInMonth)

      const hour = 8 + ((orderIndex * (profileIndex + 2) + monthIndex) % 10)

      const minute = (orderIndex * 13 + profileIndex * 9) % 60

      const createdAt = new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth(),
          day,
          hour,
          minute,
        ),
      )

      const deliveryNeighborhood = [
        "Centro",
        "São Mateus",
        "Cascatinha",
        "Aeroporto",
      ][(orderIndex + profileIndex + monthIndex) % 4]

      const streetNumber = 100 + orderIndex

      const pickupAddress = {
        rua: `Rua Fictícia ${profileIndex + 1}`,

        numero: "100",

        bairro: profiles[profileIndex].neighborhood,

        cidade: "Juiz de Fora",

        estado: "MG",

        complemento: "",
      }

      const deliveryAddress = {
        rua: `Avenida de Teste ${profileIndex + 1}`,

        numero: String(streetNumber),

        bairro: deliveryNeighborhood,

        cidade: "Juiz de Fora",

        estado: "MG",

        complemento: "",
      }

      return {
        id: randomUUID(),

        publicId: `TEST-PI-${profileIndex + 1}-${monthIndex + 1}-${orderIndex + 1}`,

        trackingToken: randomUUID(),

        status: orderIndex % 12 === 0 ? "CANCELLED" : "FINALIZED",

        pickupAddress,

        deliveryAddress,

        pickupStreet: pickupAddress.rua,

        pickupNumber: pickupAddress.numero,

        pickupNeighborhood: pickupAddress.bairro,

        pickupCity: pickupAddress.cidade,

        pickupState: pickupAddress.estado,

        deliveryStreet: deliveryAddress.rua,

        deliveryNumber: deliveryAddress.numero,

        deliveryNeighborhood: deliveryAddress.bairro,

        deliveryCity: deliveryAddress.cidade,

        deliveryState: deliveryAddress.estado,

        recipientName: `Destinatário fictício ${String(orderIndex + 1).padStart(2, "0")}`,

        recipientPhone: "00000000000",

        requesterName: "Solicitante fictício de teste",

        requesterPhone: "00000000000",

        notes: "Registro sintético para homologação; não realizar entrega.",

        price: 10 + ((profileIndex * 7 + orderIndex * 3 + monthIndex) % 23),

        companyId,

        isSeed: true,

        createdAt,

        updatedAt: createdAt,
      }
    })
  })
}

async function main() {
  const databaseUrl = loadTestDatabaseUrl()

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

  try {
    const migrationReady = await prisma.$queryRaw<Array<{
      order_seed: boolean
      intelligence_flag: boolean
    }>>`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'is_seed'
        ) AS order_seed,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Company' AND column_name = 'intelligence_enabled'
        ) AS intelligence_flag
    `

    if (
      !migrationReady[0]?.order_seed ||
      !migrationReady[0]?.intelligence_flag
    ) {
      throw new Error(
        "Seed recusado: aplique primeiro a migration Procópio Intelligence nesta base de teste.",
      )
    }

    const counts = await prisma.$transaction(async (transaction) => {
      const result: SeedCount[] = []

      for (const [profileIndex, profile] of profiles.entries()) {
        const company = await transaction.company.upsert({
          where: { document: profile.document },

          update: {},

          create: {
            document: profile.document,

            name: profile.name,

            email: `teste-${profileIndex + 1}@example.invalid`,

            phone: "00000000000",

            intelligenceEnabled: false,
          },

          select: { id: true, name: true },
        })

        await transaction.order.deleteMany({
          where: { companyId: company.id, isSeed: true },
        })

        const orders = buildOrders(company.id, profileIndex)

        const inserted = await transaction.order.createMany({ data: orders })

        result.push({ company: company.name, orders: inserted.count })
      }

      return result
    }, { maxWait: 15_000, timeout: 60_000 })

    for (const count of counts) {
      console.log(
        `${count.company}: ${count.orders} pedidos sintéticos marcados is_seed.`,
      )
    }

    console.log(
      "Seed concluído somente no project ref Supabase de teste configurado.",
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Falha ao executar seed de teste.",
  )

  process.exitCode = 1
})
