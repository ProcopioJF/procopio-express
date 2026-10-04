import { randomUUID } from "node:crypto"

import { spawnSync } from "node:child_process"

import { readFileSync } from "node:fs"

import { resolve } from "node:path"

import { Prisma, PrismaClient, RoleName } from "@prisma/client"

import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import { validateIntelligenceTestSeedEnvironment } from "./intelligence-test-seed-config.js"

const testEnvPath = resolve(process.cwd(), "backend/.env.test")

function readEnvironmentFile(path: string) {
  try {
    return dotenv.parse(readFileSync(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}

    throw error
  }
}

function loadTestEnvironment() {
  const testEnvironment = readEnvironmentFile(testEnvPath)
  const primaryEnvironmentFiles = [
    readEnvironmentFile(resolve(process.cwd(), ".env")),
    readEnvironmentFile(resolve(process.cwd(), "backend/.env")),
  ]
  const primaryDatabaseUrls = [
    process.env.DATABASE_URL,
    ...primaryEnvironmentFiles.map((environment) => environment.DATABASE_URL),
  ].filter((value): value is string => Boolean(value))
  return validateIntelligenceTestSeedEnvironment(
    testEnvironment,
    primaryDatabaseUrls,
    process.env.NODE_ENV,
    process.env.INTELLIGENCE_TEST_ALLOW_PRIMARY_DATABASE === "true",
  )
}

const profiles = [
  {
    document: "TEST-PROCOPIO-INTEL-001",
    name: "Mercado Horizonte Teste",
    email: "intelligence.company.1@test.invalid",
    neighborhood: "Centro",
    frequency: 1,
  },

  {
    document: "TEST-PROCOPIO-INTEL-002",
    name: "Farmácia Vila Exemplo",
    email: "intelligence.company.2@test.invalid",
    neighborhood: "São Mateus",
    frequency: 2,
  },

  {
    document: "TEST-PROCOPIO-INTEL-003",
    name: "Ateliê Rota Fictícia",
    email: "intelligence.company.3@test.invalid",
    neighborhood: "Cascatinha",
    frequency: 3,
  },
] as const

const monthlyOrdersPerCompany = 24
const testAdminEmail = "admin.intelligence@test.invalid"
const testAdminName = "Admin Intelligence Teste"
interface SeedCount {
  company: string
  orders: number
}
const monthStarts = (() => {
  const now = new Date()

  return Array.from(
    { length: 7 },
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
    const now = new Date()
    const isCurrentMonth =
      month.getUTCFullYear() === now.getUTCFullYear() &&
      month.getUTCMonth() === now.getUTCMonth()
    const availableDays = isCurrentMonth ? now.getUTCDate() : daysInMonth

    const monthlyOrderCount =
      monthlyOrdersPerCompany * profiles[profileIndex].frequency

    return Array.from({ length: monthlyOrderCount }, (_, orderIndex) => {
      const day = 1 + ((orderIndex * 7 + profileIndex * 3) % availableDays)

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

      const hasDistance = orderIndex % 5 !== 0
      const distance = hasDistance
        ? Number(
            (2.5 + ((orderIndex * 7 + profileIndex * 3) % 185) / 10).toFixed(1),
          )
        : null

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

        requesterName: `Solicitante fictício ${profileIndex + 1}`,

        requesterPhone: "00000000000",

        notes: "Registro sintético para homologação; não realizar entrega.",

        price: 10 + ((profileIndex * 7 + orderIndex * 3 + monthIndex) % 23),

        distance,

        perKmRate: hasDistance ? 1.3 : null,

        companyId,

        isSeed: true,

        createdAt,

        updatedAt: createdAt,
      }
    })
  })
}

function applyTestMigrations(databaseUrl: string) {
  const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js")
  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      "backend/prisma/schema.prisma",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" },
      stdio: "inherit",
    },
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Seed recusado: a aplicação das migrations no Supabase isolado falhou (código ${result.status ?? "indisponível"}).`,
    )
  }
}

async function main() {
  const { databaseUrl, userPassword } = loadTestEnvironment()
  const passwordHash = await bcrypt.hash(userPassword, 12)

  applyTestMigrations(databaseUrl)

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

    const counts = await prisma.$transaction(
      async (transaction) => {
        const result: SeedCount[] = []
        const adminRole = await transaction.role.upsert({
          where: { name: RoleName.ADMIN },
          update: {},
          create: { name: RoleName.ADMIN },
        })
        const companyRole = await transaction.role.upsert({
          where: { name: RoleName.COMPANY },
          update: {},
          create: { name: RoleName.COMPANY },
        })

        const existingAdmin = await transaction.user.findUnique({
          where: { email: testAdminEmail },
          select: { roleId: true, companyId: true, name: true },
        })
        if (
          existingAdmin &&
          (existingAdmin.roleId !== adminRole.id ||
            existingAdmin.companyId ||
            existingAdmin.name !== testAdminName)
        ) {
          throw new Error(
            "Seed recusado: a conta reservada de Admin Intelligence já pertence a outro perfil.",
          )
        }
        await transaction.user.upsert({
          where: { email: testAdminEmail },
          update: {
            name: testAdminName,
            passwordHash,
            isActive: true,
          },
          create: {
            email: testAdminEmail,
            name: testAdminName,
            passwordHash,
            roleId: adminRole.id,
          },
        })

        for (const [profileIndex, profile] of profiles.entries()) {
          const existingCompany = await transaction.company.findUnique({
            where: { document: profile.document },
            select: { name: true },
          })
          if (existingCompany && existingCompany.name !== profile.name) {
            throw new Error(
              `Seed recusado: o documento reservado da empresa ${profile.name} já está em uso.`,
            )
          }
          const company = await transaction.company.upsert({
            where: { document: profile.document },

            update: {
              name: profile.name,
              intelligenceEnabled: true,
            },

            create: {
              document: profile.document,

              name: profile.name,

              email: profile.email,

              phone: "00000000000",

              intelligenceEnabled: true,
            },

            select: { id: true, name: true },
          })

          const existingCompanyUser = await transaction.user.findUnique({
            where: { email: profile.email },
            select: { roleId: true, companyId: true },
          })
          if (
            existingCompanyUser &&
            (existingCompanyUser.roleId !== companyRole.id ||
              existingCompanyUser.companyId !== company.id)
          ) {
            throw new Error(
              `Seed recusado: a conta reservada ${profile.email} já pertence a outro perfil.`,
            )
          }
          await transaction.user.upsert({
            where: { email: profile.email },
            update: {
              name: profile.name,
              passwordHash,
              companyId: company.id,
              roleId: companyRole.id,
              isActive: true,
            },
            create: {
              email: profile.email,
              name: profile.name,
              passwordHash,
              companyId: company.id,
              roleId: companyRole.id,
            },
          })

          await transaction.order.deleteMany({
            where: { companyId: company.id, isSeed: true },
          })

          const orders = buildOrders(company.id, profileIndex)

          const inserted = await transaction.order.createMany({ data: orders })

          result.push({ company: company.name, orders: inserted.count })
        }

        return result
      },
      { maxWait: 15_000, timeout: 60_000 },
    )

    for (const count of counts) {
      console.log(
        `${count.company}: ${count.orders} pedidos sintéticos marcados is_seed.`,
      )
    }

    console.log(`Conta Admin para homologação: ${testAdminEmail}`)
    for (const profile of profiles) {
      console.log(`Conta Empresa para homologação: ${profile.email}`)
    }
    console.log(
      "Use a senha privada definida em INTELLIGENCE_TEST_USER_PASSWORD; ela não é exibida pelo script.",
    )
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
