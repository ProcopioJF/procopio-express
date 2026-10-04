import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),

  password: z.string().min(1, "Informe sua senha"),
})

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, "Informe uma data válida")

export const orderListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    pageSize: z.coerce.number().int().positive().max(100).default(25),

    search: z.string().trim().max(120).default(""),

    status: z
      .enum([
        "PENDING",
        "FINALIZED",
        "CONFIRMED",
        "ASSIGNED",
        "PICKED_UP",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED",
        "COMPLETED",
      ])
      .optional(),

    companyId: z.string().trim().min(1).max(120).optional(),

    from: dateOnlySchema.optional(),

    to: dateOnlySchema.optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "A data inicial deve ser anterior ou igual à data final.",

    path: ["to"],
  })

export const intelligenceQuestionSchema = z.object({
  question: z.string().trim().min(1, "Informe uma pergunta").max(500),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual"),

  newPassword: z
    .string()
    .min(8, "A nova senha deve ter pelo menos 8 caracteres")
    .max(100),
})

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional()

const maxDecimal10_2 = 99_999_999.99

const optionalEstimate = z.coerce
  .number()
  .nonnegative()
  .max(maxDecimal10_2)
  .nullable()
  .optional()

export const leadSchema = z.object({
  companyName: z.string().trim().min(1).max(160),

  contactName: z.string().trim().min(1).max(120),

  email: nullableText(254),

  phone: nullableText(30),

  city: nullableText(100),

  source: nullableText(100),

  stage: z
    .enum(["LEAD", "QUALIFIED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"])
    .optional(),

  estimatedMonthlyRevenue: optionalEstimate,

  notes: nullableText(2000),

  followUpAt: z.coerce.date().nullable().optional(),
})

export const financialEntryListQuerySchema = z
  .object({
    offset: z.coerce.number().int().nonnegative().max(1_000_000).default(0),

    limit: z.coerce.number().int().positive().max(100).default(100),

    search: z.string().trim().max(120).default(""),

    type: z.enum(["INCOME", "EXPENSE"]).optional(),

    from: dateOnlySchema.optional(),

    to: dateOnlySchema.optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "A data inicial deve ser anterior ou igual à data final.",

    path: ["to"],
  })

export const courierOrderStatusSchema = z.object({
  status: z.enum(["PICKED_UP", "IN_TRANSIT", "DELIVERED"]),
})

export const adminOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]),
})

export const planSchema = z.object({
  name: z.string().trim().min(1).max(100),

  description: nullableText(1000),

  monthlyPrice: z.coerce.number().nonnegative().max(maxDecimal10_2),

  annualPrice: z.coerce.number().nonnegative().max(maxDecimal10_2),

  monthlyOrderLimit: z.coerce.number().int().positive().nullable().optional(),

  isActive: z.boolean().optional(),
})

export const subscriptionSchema = z.object({
  companyId: z.string().min(1),

  planId: z.string().min(1),

  status: z.enum(["ACTIVE", "OVERDUE", "INACTIVE"]).default("ACTIVE"),

  monthlyPrice: z.coerce.number().nonnegative().max(maxDecimal10_2).optional(),

  startedAt: z.coerce.date().optional(),

  renewalAt: z.coerce.date().nullable().optional(),
})

export const subscriptionUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "OVERDUE", "INACTIVE"]).optional(),

  monthlyPrice: z.coerce.number().nonnegative().max(maxDecimal10_2).optional(),

  renewalAt: z.coerce.date().nullable().optional(),
})

export const financialEntrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),

  description: z.string().trim().min(1).max(240),

  category: z.string().trim().min(1).max(100),

  amount: z.coerce.number().positive().max(maxDecimal10_2),

  occurredAt: z.coerce.date(),

  companyId: z.string().nullable().optional(),
})

export const systemUserSchema = z.object({
  name: z.string().trim().min(1).max(120),

  email: z.string().trim().email().max(254),

  phone: nullableText(30),

  password: z.string().min(12).max(100),
})

export const systemUserActiveSchema = z.object({ isActive: z.boolean() })

export const priceTableSchema = z.object({
  name: z.string().trim().min(1).max(120),

  description: nullableText(1000),

  active: z.boolean().optional(),
})

export const priceTableOriginSchema = z.object({
  originName: z.string().trim().min(1).max(120),

  active: z.boolean().optional(),
})

export const priceTableDestinationSchema = z
  .discriminatedUnion("pricingType", [
    z.object({
      destinationName: z.string().trim().min(1).max(120),
      pricingType: z.literal("FIXED"),
      fixedPrice: z.coerce.number().positive().max(100000),
      active: z.boolean().optional(),
    }),

    z.object({
      destinationName: z.string().trim().min(1).max(120),
      pricingType: z.literal("RANGE"),
      minimumPrice: z.coerce.number().positive().max(100000),
      maximumPrice: z.coerce.number().positive().max(100000),
      active: z.boolean().optional(),
    }),

    z.object({
      destinationName: z.string().trim().min(1).max(120),
      pricingType: z.literal("PER_KM"),
      perKmRate: z.coerce.number().positive().max(100000).optional(),
      active: z.boolean().optional(),
    }),

    z.object({
      destinationName: z.string().trim().min(1).max(120),
      pricingType: z.literal("QUOTE"),
      active: z.boolean().optional(),
    }),
  ])
  .superRefine((value, context) => {
    if (
      value.pricingType === "RANGE" &&
      value.maximumPrice < value.minimumPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O limite máximo deve ser igual ou maior que o mínimo.",
      })
    }
  })

export const priceTableImportSchema = z.object({
  destinations: z.array(priceTableDestinationSchema).min(1).max(2000),
})

export const companyMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),

  email: z.string().trim().email().max(254),

  phone: nullableText(30),

  password: z.string().min(12).max(100),

  companyPermission: z
    .enum(["ADMIN", "STANDARD", "RESTRICTED"])
    .default("STANDARD"),
})

export const companyMemberUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),

    companyPermission: z.enum(["ADMIN", "STANDARD", "RESTRICTED"]).optional(),
  })
  .refine(
    (value) =>
      value.isActive !== undefined || value.companyPermission !== undefined,
  )

export const companyBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),

  phone: nullableText(30),

  address: nullableText(300),

  isActive: z.boolean().optional(),
})

export const companyCostCenterSchema = z.object({
  name: z.string().trim().min(1).max(120),

  code: nullableText(40),

  isActive: z.boolean().optional(),
})

export const addressSchema = z.object({
  rua: z.string().min(1, "Rua é obrigatória"),

  numero: z.string().min(1, "Número é obrigatório"),

  bairro: z.string().min(1, "Bairro é obrigatório"),

  cidade: z.string().optional(),

  estado: z
    .string()
    .length(2, "Estado deve ter 2 letras")
    .optional()
    .or(z.literal("")),

  cep: z
    .string()
    .regex(/^\d{8}$/, "CEP deve ter 8 dígitos")
    .optional()
    .or(z.literal("")),

  complemento: z.string().optional(),

  coordinates: z
    .object({
      latitude: z.number().finite().min(-90).max(90),

      longitude: z.number().finite().min(-180).max(180),
    })
    .optional(),
})

export const createOrderSchema = z.object({
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  recipientName: z.string().min(1, "Nome do destinatário é obrigatório"),
  recipientPhone: z.string().min(1, "Telefone do destinatário é obrigatório"),

  requesterName: z
    .string()
    .trim()
    .min(1, "Nome do solicitante é obrigatório")
    .max(120),

  requesterPhone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .max(30)
    .refine(
      (phone) => phone.replace(/\D/g, "").length >= 10,
      "Informe um telefone válido",
    ),

  notes: z.string().max(1000).optional(),
  customerId: z.string().optional(),

  branchId: z.string().optional(),
  costCenterId: z.string().optional(),
})

export const pricingSchema = z.object({
  pricingZoneId: z.string().optional(),
  distanceKm: z.coerce.number().nonnegative().optional(),
})

export const pricingRouteQuerySchema = z
  .object({
    city: z.string().trim().min(1).default("Juiz de Fora"),

    pickupNeighborhood: z.string().trim().min(1),

    deliveryNeighborhood: z.string().trim().min(1),

    pickupLatitude: z.coerce.number().min(-90).max(90).optional(),

    pickupLongitude: z.coerce.number().min(-180).max(180).optional(),

    deliveryLatitude: z.coerce.number().min(-90).max(90).optional(),

    deliveryLongitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((value) => {
    const coordinateCount = [
      value.pickupLatitude,
      value.pickupLongitude,
      value.deliveryLatitude,
      value.deliveryLongitude,
    ]

      .filter((coordinate) => coordinate !== undefined).length

    return coordinateCount === 0 || coordinateCount === 4
  }, "Informe as coordenadas completas de coleta e entrega.")

export const pricingRouteSchema = z.object({
  city: z.string().trim().min(1).max(80).default("Juiz de Fora"),

  pickupNeighborhood: z.string().trim().min(1).max(100),

  deliveryNeighborhood: z.string().trim().min(1).max(100),

  price: z.coerce.number().positive().max(100000),

  active: z.boolean().default(true),
})

export const statusSchema = z.object({
  status: z.enum([
    "PENDING",
    "FINALIZED",
    "CONFIRMED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
  ]),
  note: z.string().max(500).optional(),
})

export const whatsappRequestStatusSchema = z.object({
  status: z.enum(["DRAFT", "IN_ATTENDANCE", "COMPLETED", "CANCELLED"]),
})

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1, "Informe o nome da operação").max(120),

  whatsappOperationsNumber: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) =>
        !value ||
        [10, 11, 12, 13, 14, 15].includes(value.replace(/\D/g, "").length),
      "Informe um WhatsApp com DDD e código do país",
    ),

  supportPhone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) =>
        !value ||
        [10, 11, 12, 13, 14, 15].includes(value.replace(/\D/g, "").length),
      "Informe um telefone com DDD",
    ),

  operationCity: z.string().trim().min(1).max(80),
})

export const companySettingsSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da empresa").max(120),

  document: z.string().trim().max(30),

  phone: z
    .string()
    .trim()
    .min(10, "Informe o telefone da empresa com DDD")
    .max(30)
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Informe o telefone da empresa com DDD",
    ),

  email: z.string().trim().email("Informe um e-mail válido").or(z.literal("")),

  address: z.string().trim().max(300),

  pickupAddress: z
    .object({
      cep: z
        .string()
        .trim()
        .regex(/^\d{8}$/, "CEP da coleta deve ter 8 dígitos")
        .optional()
        .or(z.literal("")),

      rua: z.string().trim().min(1, "Rua de coleta obrigatória").max(160),

      numero: z.string().trim().min(1, "Número de coleta obrigatório").max(30),

      bairro: z.string().trim().min(1, "Bairro de coleta obrigatório").max(100),

      complemento: z.string().trim().max(160).optional().default(""),

      cidade: z.string().trim().min(1, "Cidade de coleta obrigatória").max(80),

      estado: z.string().trim().length(2).default("MG"),
    })
    .nullable(),
})

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da empresa").max(120),

  document: z.string().trim().max(30).default(""),

  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone com DDD")
    .max(30)
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Informe um telefone com DDD",
    ),

  email: z.string().trim().email("Informe um e-mail válido"),

  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres")
    .max(100),

  pickupAddress: z.object({
    cep: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "CEP deve ter 8 dígitos")
      .optional()
      .or(z.literal("")),

    rua: z.string().trim().min(1, "Informe a rua do estabelecimento").max(160),

    numero: z
      .string()
      .trim()
      .min(1, "Informe o número do estabelecimento")
      .max(30),

    bairro: z
      .string()
      .trim()
      .min(1, "Informe o bairro do estabelecimento")
      .max(100),

    complemento: z.string().trim().max(160).default(""),

    cidade: z
      .string()
      .trim()
      .min(1, "Informe a cidade do estabelecimento")
      .max(80),

    estado: z
      .string()
      .trim()
      .length(2, "Informe a UF com duas letras")
      .default("MG"),
  }),
})
