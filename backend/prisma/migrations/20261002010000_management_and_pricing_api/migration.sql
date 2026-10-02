ALTER TABLE "PriceTableDestination"
ADD COLUMN "perKmRate" DECIMAL(10,2);

ALTER TABLE "Order"
ADD COLUMN "perKmRate" DECIMAL(10,2);
