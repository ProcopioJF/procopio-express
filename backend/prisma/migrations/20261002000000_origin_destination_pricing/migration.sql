CREATE TYPE "PricingType" AS ENUM ('FIXED', 'RANGE', 'PER_KM', 'QUOTE');

CREATE TABLE "PriceTable" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceTableOrigin" (
  "id" TEXT NOT NULL,
  "priceTableId" TEXT NOT NULL,
  "originName" TEXT NOT NULL,
  "normalizedOriginName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceTableOrigin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceTableDestination" (
  "id" TEXT NOT NULL,
  "priceTableId" TEXT NOT NULL,
  "destinationName" TEXT NOT NULL,
  "normalizedDestinationName" TEXT NOT NULL,
  "pricingType" "PricingType" NOT NULL,
  "fixedPrice" DECIMAL(10,2),
  "minimumPrice" DECIMAL(10,2),
  "maximumPrice" DECIMAL(10,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceTableDestination_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
  ALTER COLUMN "price" DROP NOT NULL,
  ADD COLUMN "priceTableId" TEXT,
  ADD COLUMN "priceTableName" TEXT,
  ADD COLUMN "originNeighborhood" TEXT,
  ADD COLUMN "destinationNeighborhood" TEXT,
  ADD COLUMN "pricingType" "PricingType",
  ADD COLUMN "appliedPrice" DECIMAL(10,2),
  ADD COLUMN "minimumPrice" DECIMAL(10,2),
  ADD COLUMN "maximumPrice" DECIMAL(10,2);

CREATE UNIQUE INDEX "PriceTableOrigin_normalizedOriginName_key" ON "PriceTableOrigin"("normalizedOriginName");
CREATE INDEX "PriceTableOrigin_priceTableId_active_idx" ON "PriceTableOrigin"("priceTableId", "active");
CREATE UNIQUE INDEX "PriceTableDestination_priceTableId_normalizedDestinationName_key" ON "PriceTableDestination"("priceTableId", "normalizedDestinationName");
CREATE INDEX "PriceTableDestination_priceTableId_active_idx" ON "PriceTableDestination"("priceTableId", "active");

ALTER TABLE "PriceTableOrigin" ADD CONSTRAINT "PriceTableOrigin_priceTableId_fkey"
  FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceTableDestination" ADD CONSTRAINT "PriceTableDestination_priceTableId_fkey"
  FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_priceTableId_fkey"
  FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
