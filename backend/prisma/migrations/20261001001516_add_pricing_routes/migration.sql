-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pricingRouteId" TEXT;

-- CreateTable
CREATE TABLE "PricingRoute" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Juiz de Fora',
    "pickupNeighborhood" TEXT NOT NULL,
    "deliveryNeighborhood" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingRoute_active_city_idx" ON "PricingRoute"("active", "city");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRoute_city_pickupNeighborhood_deliveryNeighborhood_key" ON "PricingRoute"("city", "pickupNeighborhood", "deliveryNeighborhood");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingRouteId_fkey" FOREIGN KEY ("pricingRouteId") REFERENCES "PricingRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
