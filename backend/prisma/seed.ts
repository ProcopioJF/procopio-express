import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const initialRoutes = [
    ["Centro", "Cascatinha", 12],
    ["Centro", "Aeroporto", 15],
    ["Centro", "Cidade do Sol", 24],
    ["Centro", "Ladeira", 15],
    ["Centro", "Sagrado Coração", 16],
    ["São Mateus", "Cascatinha", 10],
    ["São Mateus", "Aeroporto", 15],
    ["São Mateus", "Cidade do Sol", 24],
    ["São Mateus", "Ladeira", 15],
    ["São Mateus", "Sagrado Coração", 16],
    ["Cascatinha", "Centro", 12],
    ["Cascatinha", "Aeroporto", 15],
    ["Cascatinha", "Cidade do Sol", 24],
    ["Cascatinha", "Ladeira", 15],
    ["Cascatinha", "Sagrado Coração", 16],
    ["Alto dos Passos", "Cascatinha", 10],
    ["Alto dos Passos", "Aeroporto", 15],
    ["Alto dos Passos", "Cidade do Sol", 24],
    ["Alto dos Passos", "Ladeira", 15],
    ["Alto dos Passos", "Sagrado Coração", 16],
  ] as const;
  for (const [pickupNeighborhood, deliveryNeighborhood, price] of initialRoutes) {
    await prisma.pricingRoute.upsert({
      where: { city_pickupNeighborhood_deliveryNeighborhood: { city: "Juiz de Fora", pickupNeighborhood, deliveryNeighborhood } },
      update: {},
      create: { city: "Juiz de Fora", pickupNeighborhood, deliveryNeighborhood, price },
    });
  }
  const roles = {
    admin: await prisma.role.upsert({ where: { name: RoleName.ADMIN }, update: {}, create: { name: RoleName.ADMIN } }),
    company: await prisma.role.upsert({ where: { name: RoleName.COMPANY }, update: {}, create: { name: RoleName.COMPANY } }),
    courier: await prisma.role.upsert({ where: { name: RoleName.COURIER }, update: {}, create: { name: RoleName.COURIER } }),
  };
  const company = await prisma.company.findFirst({ where: { name: "Acme Logística" } })
    ?? await prisma.company.create({ data: { name: "Acme Logística" } });
  const passwordHash = await bcrypt.hash("Procopio@123", 12);
  await prisma.user.upsert({
    where: { email: "admin@procopio.com" },
    update: { roleId: roles.admin.id, name: "Admin Procópio" },
    create: { email: "admin@procopio.com", name: "Admin Procópio", passwordHash, roleId: roles.admin.id },
  });
  await prisma.user.upsert({
    where: { email: "empresa@acme.com" },
    update: { roleId: roles.company.id, companyId: company.id, name: "Acme Logística" },
    create: { email: "empresa@acme.com", name: "Acme Logística", passwordHash, roleId: roles.company.id, companyId: company.id },
  });
  const courier = await prisma.user.upsert({
    where: { email: "joao@procopio.com" },
    update: { roleId: roles.courier.id, name: "João Entregador" },
    create: { email: "joao@procopio.com", name: "João Entregador", passwordHash, roleId: roles.courier.id },
  });
  await prisma.courier.upsert({ where: { userId: courier.id }, update: { active: true }, create: { userId: courier.id } });
}

main().finally(() => prisma.$disconnect());
