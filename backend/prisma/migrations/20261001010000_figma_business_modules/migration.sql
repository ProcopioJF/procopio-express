CREATE TYPE "CompanyPermission" AS ENUM ('ADMIN', 'STANDARD', 'RESTRICTED');
CREATE TYPE "SalesLeadStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'CLOSED_WON', 'CLOSED_LOST');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'INACTIVE');
CREATE TYPE "FinancialEntryType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "User"
ADD COLUMN "companyPermission" "CompanyPermission" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

WITH company_admins AS (
  SELECT DISTINCT ON ("companyId") "id"
  FROM "User"
  WHERE "companyId" IS NOT NULL AND "roleId" IN (
    SELECT "id" FROM "Role" WHERE "name" = 'COMPANY'
  )
  ORDER BY "companyId", "createdAt", "id"
)
UPDATE "User"
SET "companyPermission" = 'ADMIN'
WHERE "id" IN (SELECT "id" FROM company_admins);

CREATE TABLE "CompanyBranch" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "address" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostCenter" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPrice" DECIMAL(10,2) NOT NULL,
  "annualPrice" DECIMAL(10,2) NOT NULL,
  "monthlyOrderLimit" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "monthlyPrice" DECIMAL(10,2) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "renewalAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesLead" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "source" TEXT,
  "stage" "SalesLeadStage" NOT NULL DEFAULT 'LEAD',
  "estimatedMonthlyRevenue" DECIMAL(10,2),
  "notes" TEXT,
  "followUpAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL,
  "type" "FinancialEntryType" NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "companyId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD COLUMN "branchId" TEXT,
ADD COLUMN "costCenterId" TEXT;

CREATE UNIQUE INDEX "CompanyBranch_companyId_name_key" ON "CompanyBranch"("companyId", "name");
CREATE INDEX "CompanyBranch_companyId_isActive_idx" ON "CompanyBranch"("companyId", "isActive");
CREATE UNIQUE INDEX "CostCenter_companyId_name_key" ON "CostCenter"("companyId", "name");
CREATE INDEX "CostCenter_companyId_isActive_idx" ON "CostCenter"("companyId", "isActive");
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE INDEX "Subscription_companyId_status_idx" ON "Subscription"("companyId", "status");
CREATE INDEX "Subscription_status_renewalAt_idx" ON "Subscription"("status", "renewalAt");
CREATE INDEX "SalesLead_stage_updatedAt_idx" ON "SalesLead"("stage", "updatedAt");
CREATE INDEX "FinancialEntry_type_occurredAt_idx" ON "FinancialEntry"("type", "occurredAt");
CREATE INDEX "FinancialEntry_companyId_occurredAt_idx" ON "FinancialEntry"("companyId", "occurredAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");
CREATE INDEX "Order_costCenterId_idx" ON "Order"("costCenterId");

ALTER TABLE "CompanyBranch"
ADD CONSTRAINT "CompanyBranch_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostCenter"
ADD CONSTRAINT "CostCenter_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "Subscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry"
ADD CONSTRAINT "FinancialEntry_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order"
ADD CONSTRAINT "Order_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "CompanyBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Order_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
